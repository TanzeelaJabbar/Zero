// ============================================================
// Qube Smartwatch product page — core interactivity
// (AR try-on logic lives in ar.js)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initCountdowns();
  initGallery();
  initBundle();
  initSwatches();
  initQtyStepper();
  initTabs();
  initReviews();
  initFaq();
  initSeriesSlider();
});

/* ---------------- Countdown timers ---------------- */
function initCountdowns() {
  // Top announcement bar countdowns (all share one clock)
  let bannerSeconds = 40 * 60 + 54;
  const bannerEls = document.querySelectorAll('[data-countdown]');
  setInterval(() => {
    bannerSeconds = bannerSeconds > 0 ? bannerSeconds - 1 : 40 * 60 + 54;
    bannerEls.forEach(el => (el.textContent = formatHMS(bannerSeconds)));
  }, 1000);

  // Sale bar countdown
  let saleSeconds = 7 * 60 + 11;
  const saleEl = document.querySelector('[data-sale-timer]');
  setInterval(() => {
    saleSeconds = saleSeconds > 0 ? saleSeconds - 1 : 30 * 60;
    if (saleEl) saleEl.textContent = formatSale(saleSeconds);
  }, 1000);
}
function formatHMS(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function formatSale(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}h ${m}m ${s}s`;
}

/* ---------------- Gallery thumbnails ---------------- */
function initGallery() {
  const thumbs = document.querySelectorAll('.thumb');
  const mainImage = document.getElementById('mainProductImage');
  
  // Function to update main image
  function updateMainImage(thumb) {
    const imgType = thumb.dataset.img;
    if (mainImage) {
      // Handle actual image files (image1, image3, etc.)
      if (imgType === 'image1' || imgType === 'image3') {
        mainImage.style.backgroundImage = `url('${imgType}.webp')`;
        mainImage.style.backgroundSize = 'cover';
        mainImage.style.backgroundPosition = 'center';
      }
      // Handle placeholder images
      else {
        mainImage.classList.remove('ph-watch-hero');
        mainImage.classList.add(`ph-hero-${imgType}`);
      }
    }
  }
  
  // Show the active image on page load
  const activeThumb = document.querySelector('.thumb.active');
  if (activeThumb) {
    updateMainImage(activeThumb);
  }
  
  thumbs.forEach(t => {
    t.addEventListener('click', () => {
      thumbs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      updateMainImage(t);
    });
  });
}

/* ---------------- Frequently bought together bundle ---------------- */
const BUNDLE_BASE_PRICE = 5999; // Qube Smartwatch itself, always included

function initBundle() {
  const row = document.getElementById('bundleRow');
  const totalEl = document.getElementById('bundleTotal');
  const addBtn = document.getElementById('bundleAddBtn');
  if (!row || !totalEl) return;

  const checkboxes = row.querySelectorAll('[data-bundle-checkbox]');

  function recalc() {
    let total = BUNDLE_BASE_PRICE;
    checkboxes.forEach(cb => {
      const item = cb.closest('.bundle-item');
      item.classList.toggle('disabled', !cb.checked);
      if (cb.checked) total += parseInt(item.dataset.price, 10);
    });
    totalEl.textContent = 'Rs.' + total.toLocaleString('en-IN');
  }

  checkboxes.forEach(cb => cb.addEventListener('change', recalc));

  addBtn?.addEventListener('click', () => {
    const items = ['Qube Smartwatch'];
    checkboxes.forEach(cb => {
      if (cb.checked) items.push(cb.closest('.bundle-item').dataset.name);
    });
    addBtn.textContent = 'ADDED ✓';
    addBtn.disabled = true;
    setTimeout(() => {
      addBtn.textContent = 'ADD BUNDLE TO CART';
      addBtn.disabled = false;
    }, 1800);
    // Hook this up to your real cart/checkout logic — `items` holds the
    // selected bundle product names, ready to pass to an add-to-cart call.
    console.log('Bundle added to cart:', items);
  });

  recalc();
}

/* ---------------- Color swatches ---------------- */
function initSwatches() {
  const swatches = document.querySelectorAll('.swatch');
  const label = document.getElementById('selectedColor');
  const mainImage = document.getElementById('mainProductImage');
  
  swatches.forEach(s => {
    s.addEventListener('click', () => {
      swatches.forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      if (label) label.textContent = s.dataset.color;
      
      // Update main image based on selected color's data-image
      if (mainImage && s.dataset.image) {
        mainImage.style.backgroundImage = `url('${s.dataset.image}')`;
        mainImage.style.backgroundSize = 'cover';
        mainImage.style.backgroundPosition = 'center';
      }
    });
  });
}

/* ---------------- Quantity stepper ---------------- */
function initQtyStepper() {
  const val = document.getElementById('qtyValue');
  if (!val) return;
  let qty = 1;
  document.querySelectorAll('[data-qty]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.qty === 'plus') qty = Math.min(qty + 1, 10);
      else qty = Math.max(qty - 1, 1);
      val.textContent = qty;
    });
  });
}

/* ---------------- Tabs (scroll to section) ---------------- */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const map = { overview: null, review: '#reviews', specs: '#specs', faq: '#faq' };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = map[tab.dataset.tab];
      if (target) document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ---------------- Reviews ---------------- */
const REVIEWS = [
  { name: 'Zubbi khan', verified: true, date: '08/16/2026', stars: 5, title: 'Excellent 💗', body: '' },
  { name: 'Shajeeh Abbas', verified: false, date: '08/15/2026', stars: 4, title: '', body: 'Great value smartwatch, works smoothly.' },
  { name: 'Faisal Afridi', verified: true, date: '08/14/2026', stars: 5, title: 'Outstanding', body: 'Premium quality amazing 😍😍😍' },
  { name: 'Mohsin Khan', verified: false, date: '08/14/2026', stars: 5, title: '', body: 'Mohsin' },
  { name: 'Chaudhary Nasir Bashir', verified: true, date: '08/12/2026', stars: 5, title: '', body: '' },
  { name: 'Aisha', verified: false, date: '08/10/2026', stars: 5, title: '', body: 'Best Purchase Ever' },
  { name: 'Ali Raza', verified: true, date: '08/09/2026', stars: 5, title: 'Best Purchase Ever',
    body: "I love the shape which is quiet unique and beautiful and i love the features as well from ordering to delivery it was a smooth process and in such a good price. I love it 💗💗💗💗💗" },
];

function initReviews() {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  let shown = 4;
  renderReviews();

  document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    shown = Math.min(shown + 4, REVIEWS.length);
    renderReviews();
    if (shown >= REVIEWS.length) document.getElementById('loadMoreBtn').style.display = 'none';
  });

  function renderReviews() {
    grid.innerHTML = REVIEWS.slice(0, shown).map((r, i) => `
      <div class="review-card">
        <div class="review-head">
          <span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span>
          <span class="review-date">${r.date}</span>
        </div>
        <div class="review-user">
          <span class="avatar"></span> ${r.name}
          ${r.verified ? '<span class="verified">Verified</span>' : ''}
        </div>
        <div class="review-img ph-image" style="background:hsl(${(i * 47) % 360},18%,72%)"></div>
        <div class="review-body">
          ${r.title ? `<strong>${r.title}</strong>` : ''}
          ${r.body}
        </div>
      </div>
    `).join('');
  }
}

/* ---------------- FAQ accordion ---------------- */
function initFaq() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      item.parentElement.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ---------------- Explore the Qube Series slider ---------------- */
function initSeriesSlider() {
  const track = document.getElementById('seriesTrack');
  const prev = document.getElementById('seriesPrev');
  const next = document.getElementById('seriesNext');
  if (!track) return;

  const step = () => (track.querySelector('.series-card')?.offsetWidth || 150) + 16;

  prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  const cards = track.querySelectorAll('.series-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });
}