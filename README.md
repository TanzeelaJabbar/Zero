# Qube Smartwatch product page — implementation notes

## Files
- `index.html` — page structure (header, hero, all content sections, AR modal markup)
- `styles.css` — all layout/typography/color/responsive rules
- `main.js` — page interactivity (countdowns, gallery, swatches, qty, tabs, reviews, FAQ)
- `ar.js` — the camera-based AR wrist try-on (self-contained, isolated from the rest of the UI)

Drop all four in the same folder and open `index.html` over **HTTPS or `localhost`**
(camera access is blocked on plain `http://` by every browser).

## Product photography
I did not copy the photos from your reference screenshot into this build — reusing another
site's product photography isn't something I can do. Every image slot is a clearly labeled
placeholder div (`.ph-image.ph-*` classes in `styles.css`), sized and positioned exactly like
the screenshot. To finish the pixel match:

1. Export/receive the real assets (hero shot, 6 thumbnails, 4 color swatches, lifestyle
   shots, watch-face shots, review photos).
2. Either set `background-image: url(...)` on the matching `.ph-*` rule in `styles.css`,
   or replace the `<div class="ph-image ...">` with an `<img>` tag — the sizing/radius is
   already correct either way.
3. The black video block (`.video-section`) expects an actual product video at
   `assets/video/qube-showcase.mp4` — point the `<source>` in `index.html` at your file.

## Why the AR isn't WebXR
"View the watch on your wrist" needs the browser to find a **wrist** and track it every
frame — WebXR's `immersive-ar` session only gives you floor/wall plane detection and hit
testing, it has no hand or body tracking API, and it isn't implemented in Safari/iOS at all.
So a WebXR button here would either not run on iPhones, or "work" but have nothing to
actually attach the watch to.

The functional approach used instead:

```
getUserMedia (real camera feed)
   → MediaPipe Tasks Vision "HandLandmarker" (on-device ML, runs as WASM in
     plain JS — no app, no server, works in current Chrome/Firefox/Edge and iOS Safari)
   → wrist landmark + forearm direction vector, every video frame
   → canvas 2D transform draws the watch locked to the wrist in real time
```

This is a real, working implementation — not a static overlay or a fake camera
preview. Test it on a phone (desktop webcams work too, just hold your hand up).

### Required library (already wired up in `ar.js`)
```js
import 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
```
Model file (auto-downloaded and cached by the browser on first use):
```
https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
```
Both are public, CORS-enabled, Google/MediaPipe-hosted endpoints made for this exact
client-side use case — no API key or backend required. If your deployment environment
blocks third-party script/model fetches, mirror those two URLs on your own CDN/storage and
update the two `fetch`-equivalent paths inside `ensureHandLandmarker()` in `ar.js`.

### What the AR flow actually does
- Feature-detects `getUserMedia` + secure context before doing anything.
- Requests camera permission; on denial, shows a clear message telling the user how to
  re-enable it, with a "Try Again" button — never a silent failure.
- Loads the hand-tracking model; if the model can't load (e.g. offline), it degrades to a
  plain live camera view rather than crashing.
- Every frame: detects the hand, computes the wrist anchor + forearm angle + a scale
  derived from measured hand width, exponentially smooths those values to remove jitter,
  and draws the watch (procedurally, on `<canvas>`) locked to that position/rotation/scale.
- Size and rotation sliders let the user fine-tune fit on top of the tracked pose.
- A capture button flattens video + overlay to a PNG and downloads it.
- A camera-switch button toggles `facingMode` between `environment`/`user`.
- Closing the modal fully stops the media stream and the animation loop (no camera left
  running in the background, no leaked `requestAnimationFrame`).

The watch itself is drawn procedurally (case, screen, hands, crown, band) instead of using
your real product photo, again to avoid embedding photography from the reference site. Once
you have a **transparent-background PNG** of the actual watch face, replace the drawing code
in `drawWatch()` inside `ar.js` with a single `ctx.drawImage(watchImg, ...)` using the same
`x, y, angle, scale` values already being computed — the tracking logic doesn't need to
change at all.

## Responsive behavior
`styles.css` has two breakpoints (`980px`, `640px`) that restack every grid section
(hero, feature grid, split sections, health panel, faces, reviews, footer) into a single
mobile column, matching the site's general mobile pattern. Only one (desktop) screenshot was
provided, so the mobile layout follows standard responsive conventions for this design
rather than a second reference image — send over a mobile screenshot if you want it matched
more precisely.
