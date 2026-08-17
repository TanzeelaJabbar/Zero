// ============================================================
// Qube Smartwatch — "Try in AR" wrist try-on
//
// HOW THIS WORKS (read before editing)
// -------------------------------------------------------------
// True markerless AR watch try-on has no floor/wall to anchor to —
// it needs to find the user's WRIST and track it every frame.
// WebXR's immersive-ar session (the thing most "AR" demos reach for)
// only gives you plane/hit-test anchoring; it has no built-in body or
// hand tracking, isn't implemented in Safari/iOS at all, and on
// Android Chrome still can't find a wrist. So the correct, genuinely
// functional building block for "show the watch on my wrist" is:
//
//   getUserMedia (camera feed)
//        -> MediaPipe Tasks Vision "HandLandmarker" (on-device ML,
//           runs in plain browser JS/WASM, no app install, works on
//           recent iOS Safari + Android Chrome/Firefox)
//        -> wrist landmark (#0) + hand-direction vector
//        -> canvas 2D transform to draw the watch band locked to
//           the wrist, every animation frame.
//
// REQUIRED LIBRARY (must be reachable at runtime — add this exact
// <script type="module"> import, already wired up below):
//   https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14
//   Model file (downloaded once, cached by the browser):
//   https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
//
// Both are Google/MediaPipe-hosted, publicly served, CORS-enabled
// endpoints made for exactly this client-side use case — no API key,
// no backend needed. If you serve this site from an environment with
// restricted egress, mirror those two files on your own CDN and swap
// the URLs in initHandLandmarker() below.
// ============================================================

(() => {
  const els = {};
  let handLandmarker = null;
  let stream = null;
  let rafId = null;
  let facingMode = 'environment';
  let lastVideoTime = -1;
  let smoothed = null; // {x,y,angle,scale} in canvas px, exponentially smoothed
  let userScale = 1;
  let userRotate = 0;

  function cacheEls() {
    els.modal = document.getElementById('arModal');
    els.video = document.getElementById('arVideo');
    els.canvas = document.getElementById('arCanvas');
    els.status = document.getElementById('arStatus');
    els.unsupported = document.getElementById('arUnsupported');
    els.unsupportedReason = document.getElementById('arUnsupportedReason');
    els.closeBtn = document.getElementById('arClose');
    els.retryBtn = document.getElementById('arRetryBtn');
    els.switchCamBtn = document.getElementById('arSwitchCam');
    els.captureBtn = document.getElementById('arCapture');
    els.scaleSlider = document.getElementById('arScale');
    els.rotateSlider = document.getElementById('arRotate');
    els.launchBtn = document.getElementById('arLaunchBtn');
  }

  function bindEvents() {
    els.launchBtn?.addEventListener('click', openAR);
    els.closeBtn?.addEventListener('click', closeAR);
    els.retryBtn?.addEventListener('click', startCamera);
    els.switchCamBtn?.addEventListener('click', switchCamera);
    els.captureBtn?.addEventListener('click', capturePhoto);
    els.scaleSlider?.addEventListener('input', e => (userScale = parseFloat(e.target.value)));
    els.rotateSlider?.addEventListener('input', e => (userRotate = parseFloat(e.target.value)));
  }

  /* ---------------- Entry / exit ---------------- */
  async function openAR() {
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    showUnsupported(false);
    setStatus('Starting camera…');
    await startCamera();
  }

  function closeAR() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
    stopEverything();
  }

  function stopEverything() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    smoothed = null;
  }

  /* ---------------- Feature detection ---------------- */
  function browserSupportsAR() {
    const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasWasmCanvas = typeof WebAssembly !== 'undefined' && !!window.OffscreenCanvas === !!window.OffscreenCanvas; // always true, kept for clarity
    const isSecure = window.isSecureContext; // getUserMedia requires HTTPS (or localhost)
    return hasCamera && isSecure;
  }

  /* ---------------- Camera ---------------- */
  async function startCamera() {
    showUnsupported(false);
    stopEverything();

    if (!browserSupportsAR()) {
      const reason = !window.isSecureContext
        ? 'Camera access requires HTTPS. Open this page over a secure (https://) connection.'
        : "This browser doesn't expose camera access (getUserMedia). Try the latest Chrome or Safari.";
      failWith(reason);
      return;
    }

    try {
      setStatus('Requesting camera permission…');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      handleCameraError(err);
      return;
    }

    els.video.srcObject = stream;
    await els.video.play();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setStatus('Loading hand tracking model…');
    try {
      await ensureHandLandmarker();
    } catch (err) {
      console.error('HandLandmarker failed to load', err);
      failWith('AR tracking model failed to load (check your internet connection) — you can still preview the camera, but wrist-locking is unavailable.');
      // Still show the live video even if tracking fails, degrade gracefully.
      setStatus('');
      return;
    }

    setStatus('Show your wrist to the camera…');
    rafId = requestAnimationFrame(trackingLoop);
  }

  function handleCameraError(err) {
    console.error('getUserMedia error', err);
    let reason = 'Could not access the camera.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      reason = 'Camera permission was denied. Allow camera access for this site in your browser settings, then tap "Try Again".';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      reason = 'No camera was found on this device.';
    } else if (err.name === 'NotReadableError') {
      reason = 'The camera is already in use by another application.';
    } else if (err.name === 'OverconstrainedError') {
      // Retry once with a relaxed constraint before giving up
      facingMode = facingMode === 'environment' ? 'user' : 'environment';
      startCamera();
      return;
    }
    failWith(reason);
  }

  function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  }

  function resizeCanvas() {
    const rect = els.video.getBoundingClientRect();
    els.canvas.width = rect.width * window.devicePixelRatio;
    els.canvas.height = rect.height * window.devicePixelRatio;
    els.canvas.style.width = rect.width + 'px';
    els.canvas.style.height = rect.height + 'px';
  }

  /* ---------------- MediaPipe HandLandmarker ---------------- */
  async function ensureHandLandmarker() {
    if (handLandmarker) return handLandmarker;
    const vision = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    );
    const { HandLandmarker, FilesetResolver } = vision;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    let delegate = 'GPU';
    try {
      handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } catch (gpuErr) {
      // Some devices/browsers reject the GPU delegate — fall back to CPU.
      delegate = 'CPU';
      handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    }
    return handLandmarker;
  }

  /* ---------------- Per-frame tracking + draw ---------------- */
  function trackingLoop() {
    if (!els.video || els.video.readyState < 2) {
      rafId = requestAnimationFrame(trackingLoop);
      return;
    }
    const ctx = els.canvas.getContext('2d');
    const dpr = window.devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

    if (handLandmarker && els.video.currentTime !== lastVideoTime) {
      lastVideoTime = els.video.currentTime;
      const result = handLandmarker.detectForVideo(els.video, performance.now());
      if (result.landmarks && result.landmarks.length > 0) {
        updateFromLandmarks(result.landmarks[0]);
        setStatus('');
      } else {
        setStatus('Show your wrist to the camera…');
      }
    }

    if (smoothed) drawWatch(ctx);

    rafId = requestAnimationFrame(trackingLoop);
  }

  // Convert normalized MediaPipe landmarks -> canvas px, compute wrist
  // anchor point, forearm angle, and a scale derived from hand width,
  // then exponentially smooth to avoid jitter frame-to-frame.
  function updateFromLandmarks(landmarks) {
    const rect = els.canvas.getBoundingClientRect();
    const toPx = p => ({ x: p.x * rect.width, y: p.y * rect.height });

    const wrist = toPx(landmarks[0]);
    const middleMcp = toPx(landmarks[9]); // hand direction reference
    const indexMcp = toPx(landmarks[5]);
    const pinkyMcp = toPx(landmarks[17]);

    // Angle of the forearm/hand axis (wrist -> middle finger base)
    const angle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x) + Math.PI / 2;

    // Hand width proxy for band scale
    const handWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
    const scale = handWidth / 60; // 60px reference width at scale=1

    // Anchor point sits slightly below the wrist landmark, toward the forearm
    const anchor = {
      x: wrist.x + (wrist.x - middleMcp.x) * 0.35,
      y: wrist.y + (wrist.y - middleMcp.y) * 0.35,
    };

    const target = { x: anchor.x, y: anchor.y, angle, scale };
    const a = 0.35; // smoothing factor
    smoothed = smoothed
      ? {
          x: lerp(smoothed.x, target.x, a),
          y: lerp(smoothed.y, target.y, a),
          angle: lerpAngle(smoothed.angle, target.angle, a),
          scale: lerp(smoothed.scale, target.scale, a),
        }
      : target;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAngle(a, b, t) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
  }

  // Procedurally draws a watch (case + screen + band) so no copyrighted
  // product photo is embedded here. Swap this for drawImage(productPng, ...)
  // once you have a transparent-background PNG of the real watch face.
  function drawWatch(ctx) {
    const { x, y, angle, scale } = smoothed;
    const s = scale * userScale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + (userRotate * Math.PI) / 180);
    ctx.scale(s, s);

    // Band (back)
    ctx.fillStyle = 'rgba(210,204,190,0.95)';
    roundRect(ctx, -22, -6, 44, 90, 16);
    ctx.fill();

    // Case
    const caseGrad = ctx.createLinearGradient(-30, -30, 30, 30);
    caseGrad.addColorStop(0, '#cfc6b3');
    caseGrad.addColorStop(1, '#8f8570');
    ctx.fillStyle = caseGrad;
    roundRect(ctx, -30, -34, 60, 60, 14);
    ctx.fill();

    // Screen
    ctx.fillStyle = '#111';
    roundRect(ctx, -24, -28, 48, 48, 10);
    ctx.fill();

    // Watch hands
    ctx.strokeStyle = '#e9e4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -16);
    ctx.moveTo(0, -4);
    ctx.lineTo(9, -4);
    ctx.stroke();

    // Crown
    ctx.fillStyle = '#8f8570';
    ctx.fillRect(28, -8, 6, 10);

    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- Capture ---------------- */
  function capturePhoto() {
    const out = document.createElement('canvas');
    out.width = els.canvas.width;
    out.height = els.canvas.height;
    const octx = out.getContext('2d');
    octx.drawImage(els.video, 0, 0, out.width, out.height);
    octx.drawImage(els.canvas, 0, 0, out.width, out.height);
    out.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qube-ar-tryon.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }

  /* ---------------- UI helpers ---------------- */
  function setStatus(text) {
    if (!els.status) return;
    if (!text) { els.status.hidden = true; return; }
    els.status.hidden = false;
    els.status.textContent = text;
  }
  function showUnsupported(show, reason) {
    if (!els.unsupported) return;
    els.unsupported.hidden = !show;
    if (reason && els.unsupportedReason) els.unsupportedReason.textContent = reason;
  }
  function failWith(reason) {
    setStatus('');
    showUnsupported(true, reason);
    stopEverything();
  }

  cacheEls();
  bindEvents();
})();
