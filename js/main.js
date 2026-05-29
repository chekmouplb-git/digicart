// =============================================
//  DigiCART – Main JavaScript
//  Shared across index.html, apps.html, chedo.html
// =============================================

// ── DATE & TIME ──────────────────────────────
function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', hour12:false });
  const el = document.getElementById('datetimeDisplay');
  if (el) el.textContent = `${dateStr} | ${timeStr}`;
  const fy = document.getElementById('footerYear');
  if (fy) fy.textContent = now.getFullYear();
}
updateDateTime();
setInterval(updateDateTime, 30000);

// ── TAGLINE ───────────────────────────────────
(function () {
  const el = document.getElementById('tagline');
  if (!el || !DIGICART_DATA?.taglines?.length) return;
  el.textContent = DIGICART_DATA.taglines[Math.floor(Math.random() * DIGICART_DATA.taglines.length)];
})();

// ── WEATHER ──────────────────────────────────
async function fetchWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=14.1717&longitude=121.2411&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FManila');
    const data = await res.json();
    const pct = data.hourly.precipitation_probability[new Date().getHours()] ?? 0;
    const el = document.getElementById('weatherPct');
    if (el) el.textContent = `${pct}%`;
    const icon = document.querySelector('.weather-icon');
    if (icon) icon.textContent = pct >= 70 ? '⛈️' : pct >= 40 ? '🌦️' : pct >= 20 ? '🌤️' : '☀️';
  } catch (e) {}
}
fetchWeather();

// ── RENDER EVENTS (index.html only) ──────────
function renderEvents() {
  const container = document.getElementById('eventsList');
  if (!container || !DIGICART_DATA?.events) return;
  let html = '';
  DIGICART_DATA.events.forEach(group => {
    html += `<div class="event-month">${group.month}</div>`;
    group.items.forEach(ev => {
      html += `<div class="event-item">
        <span class="event-day">${ev.day}</span>
        <span class="event-name">${ev.name}</span>
      </div>`;
    });
  });
  container.innerHTML = html;
}
renderEvents();

// ── RENDER MEMOS (index.html only) ───────────
function renderMemos() {
  const container = document.getElementById('memoList');
  if (!container || !DIGICART_DATA?.memos) return;
  container.innerHTML = DIGICART_DATA.memos.map(m => `
    <div class="update-item">
      <span class="update-tag">${m.tag}</span>
      <span class="update-text">${m.text}</span>
    </div>`).join('');
}
renderMemos();

// ── RENDER NEWS (index.html only) ─────────────
function renderNews() {
  const container = document.getElementById('newsList');
  if (!container || !DIGICART_DATA?.news) return;
  container.innerHTML = DIGICART_DATA.news.map(n =>
    `<div class="news-item">${n.text}</div>`).join('');
}
renderNews();

// ── SEARCH / FILTER APPS (apps.html only) ────
function filterApps(query) {
  const q = query.trim().toLowerCase();
  const cards = document.querySelectorAll('#appsGrid .app-card');
  if (!cards.length) return;

  const clearBtn = document.getElementById('searchClear');
  const hint = document.getElementById('searchHint');
  const noResults = document.getElementById('noResults');
  const noResultsTerm = document.getElementById('noResultsTerm');

  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

  let visible = 0;
  cards.forEach(card => {
    const keywords = (card.getAttribute('data-name') || '').toLowerCase();
    const name = (card.querySelector('.app-name')?.textContent || '').toLowerCase();
    const match = !q || keywords.includes(q) || name.includes(q);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  if (hint) hint.innerHTML = q
    ? `Found <strong>${visible}</strong> application${visible !== 1 ? 's' : ''} for "<em>${query}</em>"`
    : `Showing all <strong>${cards.length}</strong> applications`;

  if (noResults) {
    noResults.style.display = visible === 0 ? 'flex' : 'none';
    noResults.style.flexDirection = 'column';
    noResults.style.alignItems = 'center';
  }
  if (noResultsTerm) noResultsTerm.textContent = query;
}

function clearSearch() {
  const input = document.getElementById('appSearch');
  if (input) { input.value = ''; filterApps(''); input.focus(); }
}

// ── OPEN APP LINKS ────────────────────────────
function openApp(el) {
  el.preventDefault && el.preventDefault();
  const link = el.getAttribute('data-link');
  if (!link || link.startsWith('PASTE_')) {
    showToast('🔗 Link not yet configured. Replace the placeholder URL for this app in the HTML file.');
    return;
  }
  window.open(link, '_blank', 'noopener,noreferrer');
}

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
