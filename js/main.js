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
// Month name → 0-based index (supports full and abbreviated forms).
const EVENT_MONTHS = {
  jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3,
  may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7,
  sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11
};

// Parse a "June 2026" style label → { m: 5, y: 2026 }; fields are null if absent.
function parseMonthYear(monthStr) {
  const tokens = String(monthStr || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  let m = null, y = null;
  tokens.forEach(t => {
    if (m === null && EVENT_MONTHS[t] !== undefined) m = EVENT_MONTHS[t];
    if (y === null && /^\d{4}$/.test(t)) y = parseInt(t, 10);
  });
  return { m, y };
}

// Build a local-midnight Date for an event, or null if it can't be dated.
function eventDate(monthStr, dayStr) {
  const { m, y } = parseMonthYear(monthStr);
  const d = parseInt(String(dayStr).replace(/[^0-9]/g, ''), 10);
  if (m === null || y === null || !d) return null;
  return new Date(y, m, d);
}

function renderEventGroups(groups) {
  const container = document.getElementById('eventsList');
  if (!container) return;

  // Today at local midnight, so an event happening *today* still counts as upcoming.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  // Pass 1: find the soonest upcoming date (today or later) across all groups.
  let nextTs = null;
  (groups || []).forEach(group => {
    (group.items || []).forEach(ev => {
      const d = eventDate(group.month, ev.day);
      if (d) {
        const ts = d.getTime();
        if (ts >= todayTs && (nextTs === null || ts < nextTs)) nextTs = ts;
      }
    });
  });

  // Pass 2: render, tagging each event as past / next where applicable.
  let html = '';
  (groups || []).forEach(group => {
    html += `<div class="event-month">${group.month}</div>`;
    (group.items || []).forEach(ev => {
      const d = eventDate(group.month, ev.day);
      const ts = d ? d.getTime() : null;
      let cls = 'event-item';
      let badge = '';
      if (ts !== null && ts < todayTs) {
        cls += ' event-past';
      } else if (ts !== null && nextTs !== null && ts === nextTs) {
        cls += ' event-next';
        badge = `<span class="event-badge">${ts === todayTs ? 'Today' : 'Up next'}</span>`;
      }
      html += `<div class="${cls}">
        <span class="event-day">${ev.day}</span>
        <span class="event-name">${ev.name}</span>
        ${badge}
      </div>`;
    });
  });
  container.innerHTML = html || '<p class="events-empty">No upcoming events.</p>';
}

// Minimal RFC-4180 CSV parser → array of rows (each row = array of cells).
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Build {month, items:[{day,name}]} from CSV rows.
// Row 1 = [Month, Year]; rows 2+ = [Day, Event name].
function eventsFromSheetRows(rows) {
  const clean = (rows || []).filter(r => r.some(c => (c || '').trim() !== ''));
  if (!clean.length) return null;
  const month = `${(clean[0][0] || '').trim()} ${(clean[0][1] || '').trim()}`.trim();
  const items = [];
  for (let i = 1; i < clean.length; i++) {
    const day = (clean[i][0] || '').trim();
    const name = (clean[i][1] || '').trim();
    if (day || name) items.push({ day, name });
  }
  return items.length ? [{ month, items }] : null;
}

// ── LIVE LOADER 1: gviz (CORS-proof, loads the tab by name) ──
// Loaded via a <script> tag so it is NOT subject to CORS, unlike fetch().
// Uses headers=1 so row 1 (Month / Year) becomes the column LABELS and the
// remaining rows are pure day/event data — this also avoids gviz's
// mixed-column type bug that can blank out text cells.
function loadEventsViaGviz(sheetId, tab) {
  return new Promise((resolve, reject) => {
    const cb = 'gvizEventsCb_' + Math.random().toString(36).slice(2);
    let script;
    const cleanup = () => { try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (script) script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('gviz request timed out')); }, 12000);

    window[cb] = (resp) => {
      clearTimeout(timer);
      try {
        if (!resp || resp.status === 'error') {
          throw new Error('gviz error: ' + JSON.stringify(resp && resp.errors));
        }
        const cols = (resp.table.cols || []).map(c => (c.label || '').trim());
        const month = `${cols[0] || ''} ${cols[1] || ''}`.trim();
        const val = (cell) => cell ? (cell.f != null ? cell.f : (cell.v != null ? cell.v : '')) : '';
        const items = (resp.table.rows || [])
          .map(r => {
            const c = r.c || [];
            return { day: String(val(c[0])).trim(), name: String(val(c[1])).trim() };
          })
          .filter(it => it.day || it.name);
        resolve(items.length ? [{ month, items }] : null);
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    };

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
      `?tqx=out:json;responseHandler:${cb}&sheet=${encodeURIComponent(tab)}&headers=1`;
    script = document.createElement('script');
    script.src = url;
    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Could not load the sheet. Check the Sheet ID and that sharing is set to "Anyone with the link → Viewer".'));
    };
    document.head.appendChild(script);
  });
}

// ── LIVE LOADER 2: published CSV via fetch (may be blocked by CORS) ──
async function loadEventsViaCsv(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return eventsFromSheetRows(parseCSV(await res.text()));
}

async function renderEvents() {
  const container = document.getElementById('eventsList');
  if (!container) return;

  const sheetId  = DIGICART_DATA?.eventsSheetId;
  const sheetTab = DIGICART_DATA?.eventsSheetTab || 'Events';
  const csvUrl   = DIGICART_DATA?.eventsCsvUrl;
  const fallback = DIGICART_DATA?.events || [];

  // 1) Preferred: gviz (no CORS problems). Used when a Sheet ID is set.
  if (sheetId) {
    try {
      const groups = await loadEventsViaGviz(sheetId, sheetTab);
      if (groups) { console.info('📅 Events: loaded live via gviz.'); renderEventGroups(groups); return; }
      console.warn('📅 Events: gviz returned no rows; trying next source.');
    } catch (e) {
      console.warn('📅 Events: gviz failed, trying next source ->', e.message || e);
    }
  }

  // 2) Fallback: published CSV (works only if not blocked by CORS).
  if (csvUrl) {
    try {
      const groups = await loadEventsViaCsv(csvUrl);
      if (groups) { console.info('📅 Events: loaded live via published CSV.'); renderEventGroups(groups); return; }
      console.warn('📅 Events: CSV returned no rows; showing static list.');
    } catch (e) {
      console.warn('📅 Events: CSV fetch failed (often CORS), showing static list ->', e.message || e);
    }
  }

  // 3) Last resort: static list from data.js.
  if (!sheetId && !csvUrl) console.info('📅 Events: no live source set; showing static list.');
  renderEventGroups(fallback);
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

// Set the initial count dynamically on page load
(function initAppCount() {
  const hint = document.getElementById('searchHint');
  const cards = document.querySelectorAll('#appsGrid .app-card');
  if (hint && cards.length) {
    hint.innerHTML = `Showing all <strong>${cards.length}</strong> application${cards.length !== 1 ? 's' : ''}`;
  }
})();

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
  const link = (el.getAttribute('data-link') || '').trim();
  const card = el.closest('.app-card');
  const appName = card?.querySelector('.app-name')?.textContent || 'This application';

  // No real URL yet (empty, "#", or a PASTE_..._HERE placeholder) → Coming Soon.
  const notConfigured = !link || link === '#' || link.startsWith('PASTE_');
  if (notConfigured) {
    showComingSoonModal(appName);
    return false;
  }

  // Check if the card is restricted
  const isRestricted = card && card.classList.contains('restricted');

  if (isRestricted) {
    showRestrictedModal(appName, link);
  } else {
    window.open(link, '_blank', 'noopener,noreferrer');
  }
  return false;
}

// ── COMING SOON MODAL ─────────────────────────
// Shown when an app card has no real link yet. Self-contained: it injects
// its own styles (using the site's CSS variables) so no CSS file changes
// are needed. Matches the look of the other modals.
function showComingSoonModal(appName) {
  const existing = document.getElementById('coming-soon-modal');
  if (existing) existing.remove();

  if (!document.getElementById('coming-soon-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'coming-soon-modal-styles';
    style.textContent = `
      #coming-soon-modal { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.25s ease; }
      #coming-soon-modal.modal-visible { opacity: 1; }
      #coming-soon-modal .cs-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); }
      #coming-soon-modal .cs-box { position: relative; background: var(--white, #fff); border-radius: 18px; padding: 36px 32px 28px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.25); transform: translateY(16px); transition: transform 0.25s ease; text-align: center; }
      #coming-soon-modal.modal-visible .cs-box { transform: translateY(0); }
      #coming-soon-modal .cs-icon { font-size: 46px; margin-bottom: 12px; line-height: 1; }
      #coming-soon-modal .cs-title { font-family: var(--font-display, 'Playfair Display', serif); font-size: 1.4rem; color: var(--maroon, #7B1C2A); margin-bottom: 8px; }
      #coming-soon-modal .cs-app-name { font-size: 13px; font-weight: 700; color: var(--gold, #C8960C); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 16px; }
      #coming-soon-modal .cs-msg { font-size: 14px; color: var(--gray-600, #555); line-height: 1.55; margin-bottom: 24px; }
      #coming-soon-modal .cs-btn { padding: 11px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; font-family: var(--font-body, 'Source Sans 3', sans-serif); cursor: pointer; border: none; background: var(--maroon, #7B1C2A); color: #fff; transition: background 0.2s, transform 0.15s; }
      #coming-soon-modal .cs-btn:hover { background: var(--maroon-dark, #5d0f1c); transform: translateY(-1px); }
    `;
    document.head.appendChild(style);
  }

  const modal = document.createElement('div');
  modal.id = 'coming-soon-modal';
  modal.innerHTML = `
    <div class="cs-backdrop" onclick="closeComingSoonModal()"></div>
    <div class="cs-box" role="dialog" aria-modal="true" aria-labelledby="cs-title">
      <div class="cs-icon">🚧</div>
      <h2 class="cs-title" id="cs-title">Coming Soon</h2>
      <p class="cs-app-name">${appName}</p>
      <p class="cs-msg">This application isn't available just yet. Please check back soon — it's on the way!</p>
      <button class="cs-btn" onclick="closeComingSoonModal()">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => modal.classList.add('modal-visible'));
  document.addEventListener('keydown', handleComingSoonKeydown);
}

function handleComingSoonKeydown(e) {
  if (e.key === 'Escape') closeComingSoonModal();
}

function closeComingSoonModal() {
  const modal = document.getElementById('coming-soon-modal');
  if (!modal) return;
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.remove(), 250);
  document.removeEventListener('keydown', handleComingSoonKeydown);
}

// ── RESTRICTED ACCESS MODAL ───────────────────
function showRestrictedModal(appName, link) {
  // Remove existing modal if any
  const existing = document.getElementById('restricted-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'restricted-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeRestrictedModal()"></div>
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-icon">🔒</div>
      <h2 class="modal-title" id="modal-title">Restricted Application</h2>
      <p class="modal-app-name">${appName}</p>
      <div class="modal-body">
        <p>This application is restricted to <strong>authorized personnel only</strong>.</p>
        <div class="modal-steps">
          <div class="modal-step">
            <span class="step-num">1</span>
            <span>Make sure you are signed in with your <strong>UP or authorized Google account</strong></span>
          </div>
          <div class="modal-step">
            <span class="step-num">2</span>
            <span>Click <strong>Continue</strong> — Google will verify your identity</span>
          </div>
          <div class="modal-step">
            <span class="step-num">3</span>
            <span>If access is denied, contact the <strong>CHE office</strong> to request authorization</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick="closeRestrictedModal()">Cancel</button>
        <button class="modal-btn continue" onclick="proceedToApp('${link}')">
          Continue <span>→</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(() => modal.classList.add('modal-visible'));

  // Close on Escape key
  document.addEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(e) {
  if (e.key === 'Escape') closeRestrictedModal();
}

function closeRestrictedModal() {
  const modal = document.getElementById('restricted-modal');
  if (!modal) return;
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.remove(), 250);
  document.removeEventListener('keydown', handleModalKeydown);
}

function proceedToApp(link) {
  closeRestrictedModal();
  window.open(link, '_blank', 'noopener,noreferrer');
}

// ── EMAIL VERIFICATION – CHE DO PORTAL ───────
// This is the GLOBAL fallback list. It is only used by a card that
// does NOT have its own `data-emails` attribute (or has an empty one).
// To set per-app access, edit the `data-emails` attribute on each card
// in chedo.html — see that file for examples.
// ▼▼▼ ADD OR REMOVE GLOBAL FALLBACK EMAILS HERE ▼▼▼
const CHEDO_ALLOWED_EMAILS = [
  'jsamparo@up.edu.ph',
  'mrnguyenorca@up.edu.ph',
  'rzalbor@up.edu.ph',
  'iudanao@up.edu.ph',
  'ameusebio@up.edu.ph',
  'bgeusebio1@up.edu.ph',
  'eadelrosario1@up.edu.ph',
  'mcdacanay@up.edu.ph',
  'edbatas@up.edu.ph',
  'ssmorales@up.edu.ph',
  'mddimaano4@up.edu.ph',
  'jpencina@up.edu.ph',
  'crbalasabas@up.edu.ph',
  'marepomanta@up.edu.ph',
  'mrmanalo4@up.edu.ph',
  'hbexconde@up.edu.ph',
  'kmgironella@up.edu.ph',
  'ldsaucelo@up.edu.ph',
  'ddegala@up.edu.ph',
  'lbsolis@up.edu.ph',
  'mrvalenzuela2@up.edu.ph',
  'che_do.uplb@up.edu.ph',
  'che.kmo.uplb@up.edu.ph',
  // add more emails below this line...
];
// ▲▲▲ END OF EMAIL LIST ▲▲▲

/**
 * Checks an email against an authorized list.
 * @param {string}   email        The email the user typed.
 * @param {string[]} [allowedList] Optional per-card list. If omitted or
 *                                 empty, the global CHEDO_ALLOWED_EMAILS
 *                                 list is used as a fallback.
 */
function isValidChedoEmail(email, allowedList) {
  const normalized = email.trim().toLowerCase();
  const list = (Array.isArray(allowedList) && allowedList.length)
    ? allowedList
    : CHEDO_ALLOWED_EMAILS;
  // Normalize each entry too, so stray spaces / capitalization don't matter.
  return list.some(e => e.trim().toLowerCase() === normalized);
}

// ── GOOGLE SIGN-IN GATE – CHE DO PORTAL ──────
const GOOGLE_CLIENT_ID = '709954250471-t46501fs9rhtfve1rt4bvc5phvenvsl5.apps.googleusercontent.com';

/**
 * Injects the Google Sign-In modal styles once.
 */
function injectGoogleModalStyles() {
  if (document.getElementById('google-signin-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'google-signin-modal-styles';
  style.textContent = `
    #google-signin-modal {
      position: fixed; inset: 0; z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.25s ease;
    }
    #google-signin-modal.modal-visible { opacity: 1; }
    #google-signin-modal .ev-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    }
    #google-signin-modal .ev-box {
      position: relative; background: #fff; border-radius: 18px;
      padding: 36px 32px 28px; max-width: 420px; width: 92%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      transform: translateY(16px); transition: transform 0.25s ease;
      text-align: center;
    }
    #google-signin-modal.modal-visible .ev-box { transform: translateY(0); }
    #google-signin-modal .ev-icon { font-size: 46px; margin-bottom: 12px; line-height: 1; }
    #google-signin-modal .ev-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.4rem; color: #0D2B1F; margin-bottom: 8px;
    }
    #google-signin-modal .ev-subtitle {
      font-size: 13.5px; color: #555; line-height: 1.55; margin-bottom: 4px;
    }
    #google-signin-modal .ev-divider {
      display: flex; align-items: center; gap: 10px;
      margin: 18px 0 4px; font-size: 11px; color: #aaa;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    #google-signin-modal .ev-divider::before,
    #google-signin-modal .ev-divider::after {
      content: ''; flex: 1; height: 1px; background: #e5e5e5;
    }
    #google-signin-modal #google-btn-wrap {
      display: flex; justify-content: center; margin: 10px 0 6px;
    }
    #google-signin-modal .ev-error-msg {
      display: none; align-items: flex-start; gap: 6px;
      background: #fff3cd; border: 1px solid #ffc107;
      border-radius: 8px; padding: 10px 14px;
      font-size: 13px; color: #7a5000; text-align: left;
      margin: 10px 0 0;
    }
    #google-signin-modal .ev-hint {
      font-size: 12px; color: #888; line-height: 1.5; margin-top: 16px;
    }
    #google-signin-modal .ev-actions {
      margin-top: 18px; display: flex; justify-content: center;
    }
    #google-signin-modal .ev-btn.cancel {
      padding: 9px 24px; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer; border: 1px solid #ddd;
      background: #f5f5f5; color: #555;
      font-family: 'Source Sans 3', sans-serif;
      transition: background 0.2s;
    }
    #google-signin-modal .ev-btn.cancel:hover { background: #eaeaea; }
  `;
  document.head.appendChild(style);
}

/**
 * Shows the Google Sign-In modal gate.
 * @param {Function} onVerified  Called with the verified email on success.
 * @param {string}   [context]   Label for what's being accessed.
 * @param {string[]} [allowedEmails] Per-card list; falls back to global.
 * @param {Function} [onCancel]  Called if the user cancels.
 */
function showGoogleSignInModal(onVerified, context, allowedEmails, onCancel) {
  const existing = document.getElementById('google-signin-modal');
  if (existing) existing.remove();

  injectGoogleModalStyles();

  const contextLine = context
    ? `<p class="ev-subtitle">Sign in to access <strong>${context}</strong>. Only authorized CHE DO employees may proceed.</p>`
    : `<p class="ev-subtitle">This portal is restricted to <strong>authorized CHE Office of the Dean employees</strong> only.</p>`;

  const modal = document.createElement('div');
  modal.id = 'google-signin-modal';
  modal._onVerified = onVerified;
  modal._onCancel = onCancel;
  modal._allowedEmails = allowedEmails;

  modal.innerHTML = `
    <div class="ev-backdrop"></div>
    <div class="ev-box" role="dialog" aria-modal="true" aria-labelledby="gsignin-title">
      <div class="ev-icon">🔐</div>
      <h2 class="ev-title" id="gsignin-title">CHE DO Portal Access</h2>
      ${contextLine}
      <div class="ev-divider">Sign in with Google</div>
      <div id="google-btn-wrap"></div>
      <div class="ev-error-msg" id="google-signin-error">
        <span>⚠️</span>
        <span id="google-signin-error-text">Access denied. Your account is not on the authorized list.</span>
      </div>
      <p class="ev-hint">Use your authorized <strong>UP Google account</strong> (@up.edu.ph) to sign in.</p>
      <div class="ev-actions">
        <button class="ev-btn cancel" id="gsignin-cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#gsignin-cancel-btn').addEventListener('click', closeGoogleSignInModal);

  requestAnimationFrame(() => modal.classList.add('modal-visible'));
  document.addEventListener('keydown', handleGoogleSignInKeydown);

  // Wait for GIS SDK to be ready before rendering button
  function renderGoogleButton() {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      ux_mode: 'popup',
    });
    google.accounts.id.renderButton(
      document.getElementById('google-btn-wrap'),
      { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280 }
    );
  }

  if (typeof google !== 'undefined' && google.accounts) {
    renderGoogleButton();
  } else {
    // SDK not yet loaded — poll briefly
    let attempts = 0;
    const wait = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(wait);
        renderGoogleButton();
      } else if (++attempts > 20) {
        clearInterval(wait);
        const wrap = document.getElementById('google-btn-wrap');
        if (wrap) wrap.innerHTML = '<p style="color:#c00;font-size:13px;">⚠️ Google Sign-In failed to load. Check your connection and refresh.</p>';
      }
    }, 200);
  }
}

function handleGoogleSignInKeydown(e) {
  if (e.key === 'Escape') closeGoogleSignInModal();
}

function closeGoogleSignInModal() {
  const modal = document.getElementById('google-signin-modal');
  if (!modal) return;
  const onCancel = modal._verified ? null : modal._onCancel;
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.remove(), 250);
  document.removeEventListener('keydown', handleGoogleSignInKeydown);
  if (typeof onCancel === 'function') onCancel();
}

/**
 * Callback from Google — receives the signed credential JWT.
 * Decodes the payload to get the verified email and checks it.
 */
function handleGoogleCredential(response) {
  const modal = document.getElementById('google-signin-modal');
  if (!modal) return;

  // Decode JWT payload (middle segment, base64url → JSON)
  let payload;
  try {
    const base64 = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(atob(base64));
  } catch (e) {
    showGoogleSignInError('Could not read sign-in response. Please try again.');
    return;
  }

  const email = (payload.email || '').toLowerCase().trim();
  const allowedEmails = modal._allowedEmails;

  if (!isValidChedoEmail(email, allowedEmails)) {
    showGoogleSignInError(`${email} is not on the authorized list. Contact the CHE office for access.`);
    return;
  }

  // ✅ Verified — close modal and fire callback
  const onVerified = modal._onVerified;
  modal._verified = true;
  closeGoogleSignInModal();
  if (typeof onVerified === 'function') onVerified(email);
}

function showGoogleSignInError(msg) {
  const errEl = document.getElementById('google-signin-error');
  const errText = document.getElementById('google-signin-error-text');
  if (errEl) errEl.style.display = 'flex';
  if (errText) errText.textContent = msg;
}

/**
 * ACCESS GUARD for chedo.html.
 * Hides page content and requires Google Sign-In with an authorized
 * UP account before revealing it. Cancelling returns to the main portal.
 */
function guardChedoPage() {
  const onChedo = document.querySelector('.do-banner')
    || /chedo(\.html)?$/i.test(location.pathname);
  if (!onChedo) return;

  if (document.body.dataset.chedoUnlocked === 'yes') return;
  if (document.getElementById('google-signin-modal')) return;

  const content = document.querySelector('main.page-section');
  if (content) content.style.visibility = 'hidden';

  showGoogleSignInModal(
    (email) => {
      document.body.dataset.chedoUnlocked = 'yes';
      if (content) content.style.visibility = '';
      console.info(`✅ CHE DO Portal unlocked for ${email}`);
    },
    'the CHE DO Portal',
    null, // use global CHEDO_ALLOWED_EMAILS list
    () => { window.location.replace('index.html'); }
  );
}

// Run on load and on back/forward-cache restores.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', guardChedoPage);
} else {
  guardChedoPage();
}
window.addEventListener('pageshow', guardChedoPage);

/**
 * Called by "Open App" buttons on chedo.html.
 * Requires Google Sign-In before opening the app link.
 */
function openChedoApp(el) {
  const link = (el.getAttribute('data-link') || '').trim();
  const card = el.closest('.app-card');
  const appName = card?.querySelector('.app-name')?.textContent || 'This application';

  if (!link || link === '#' || link.startsWith('PASTE_')) {
    showComingSoonModal(appName);
    return false;
  }

  const emailsAttr = card?.getAttribute('data-emails') || '';
  const allowedEmails = emailsAttr.split(',').map(e => e.trim()).filter(Boolean);

  showGoogleSignInModal(
    () => { window.open(link, '_blank', 'noopener,noreferrer'); },
    appName,
    allowedEmails,
    null
  );
  return false;
}

// ── GOOGLE SIGN-IN GATE – apps.html RESTRICTED CARDS ──
/**
 * Called by "Open App" buttons on restricted cards in apps.html
 * (e.g. Vehicle Reservation, Fund Utilization). Requires Google
 * Sign-In with an email on the card's `data-emails` allowlist
 * before opening the app link. Replaces the old informational
 * "Continue" modal (showRestrictedModal) for these cards.
 */
function openGatedApp(el) {
  const link = (el.getAttribute('data-link') || '').trim();
  const card = el.closest('.app-card');
  const appName = card?.querySelector('.app-name')?.textContent || 'This application';

  if (!link || link === '#' || link.startsWith('PASTE_')) {
    showComingSoonModal(appName);
    return false;
  }

  const emailsAttr = el.getAttribute('data-emails') || card?.getAttribute('data-emails') || '';
  const allowedEmails = emailsAttr.split(',').map(e => e.trim()).filter(Boolean);

  showGoogleSignInModal(
    () => { window.open(link, '_blank', 'noopener,noreferrer'); },
    appName,
    allowedEmails,
    null
  );
  return false;
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
