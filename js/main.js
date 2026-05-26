// =============================================
//  DigiCART – Main JavaScript
// =============================================

// ── DATE & TIME ──────────────────────────────
function updateDateTime() {
  const now = new Date();
  const dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
  const dateStr = now.toLocaleDateString('en-GB', dateOpts).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-GB', timeOpts);
  const el = document.getElementById('datetimeDisplay');
  if (el) el.textContent = `${dateStr} | ${timeStr}`;
  document.getElementById('footerYear').textContent = now.getFullYear();
}
updateDateTime();
setInterval(updateDateTime, 30000);

// ── TAGLINE ───────────────────────────────────
(function () {
  const el = document.getElementById('tagline');
  const tags = DIGICART_DATA.taglines;
  if (el && tags && tags.length) {
    el.textContent = tags[Math.floor(Math.random() * tags.length)];
  }
})();

// ── WEATHER ──────────────────────────────────
// Uses Open-Meteo (free, no API key needed) based on Los Baños, Laguna
async function fetchWeather() {
  try {
    const lat = 14.1717;
    const lon = 121.2411;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FManila`;
    const res = await fetch(url);
    const data = await res.json();
    const hours = data.hourly.precipitation_probability;
    const now = new Date().getHours();
    const pct = hours[now] ?? hours[0] ?? 0;
    const el = document.getElementById('weatherPct');
    if (el) el.textContent = `${pct}%`;

    const icon = document.querySelector('.weather-icon');
    if (icon) {
      if (pct >= 70) icon.textContent = '⛈️';
      else if (pct >= 40) icon.textContent = '🌦️';
      else if (pct >= 20) icon.textContent = '🌤️';
      else icon.textContent = '☀️';
    }
  } catch (e) {
    const el = document.getElementById('weatherPct');
    if (el) el.textContent = '—%';
  }
}
fetchWeather();

// ── RENDER EVENTS ─────────────────────────────
function renderEvents() {
  const container = document.getElementById('eventsList');
  if (!container || !DIGICART_DATA.events) return;
  let html = '';
  DIGICART_DATA.events.forEach(group => {
    html += `<div class="event-month">${group.month}</div>`;
    group.items.forEach(ev => {
      html += `
        <div class="event-item">
          <span class="event-day">${ev.day}</span>
          <span class="event-name">${ev.name}</span>
        </div>`;
    });
  });
  container.innerHTML = html;
}
renderEvents();

// ── RENDER MEMOS ──────────────────────────────
function renderMemos() {
  const container = document.getElementById('memoList');
  if (!container || !DIGICART_DATA.memos) return;
  let html = '';
  DIGICART_DATA.memos.forEach(m => {
    html += `
      <div class="update-item">
        <span class="update-tag">${m.tag}</span>
        <span class="update-text">${m.text}</span>
      </div>`;
  });
  container.innerHTML = html;
}
renderMemos();

// ── RENDER NEWS ───────────────────────────────
function renderNews() {
  const container = document.getElementById('newsList');
  if (!container || !DIGICART_DATA.news) return;
  let html = '';
  DIGICART_DATA.news.forEach(n => {
    html += `<div class="news-item">${n.text}</div>`;
  });
  container.innerHTML = html;
}
renderNews();

// ── OPEN APP LINKS ─────────────────────────────
function openApp(el) {
  el.preventDefault && el.preventDefault();
  const link = el.getAttribute('data-link');
  if (!link || link.startsWith('PASTE_')) {
    showToast('🔗 Link not yet configured. Edit js/data.js or the HTML to add the URL.');
    return;
  }
  window.open(link, '_blank', 'noopener,noreferrer');
}

// ── CHE DO PORTAL TOGGLE ──────────────────────
function toggleCHEDO() {
  const subapps = document.getElementById('chedoSubapps');
  const arrow = document.getElementById('chedoArrow');
  if (!subapps) return;
  const isOpen = subapps.classList.toggle('open');
  arrow.textContent = isOpen ? '↓' : '→';
  if (isOpen) subapps.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── ACTIVE NAV HIGHLIGHT ──────────────────────
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

// ── TOAST NOTIFICATION ────────────────────────
function showToast(msg) {
  let toast = document.getElementById('digi-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'digi-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #2C2A24; color: #fff; padding: 10px 20px; border-radius: 8px;
      font-size: 13px; font-family: 'Source Sans 3', sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 9999;
      opacity: 0; transition: opacity 0.3s; max-width: 90vw; text-align: center;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}
