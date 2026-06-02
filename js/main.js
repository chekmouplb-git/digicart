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
function renderEventGroups(groups) {
  const container = document.getElementById('eventsList');
  if (!container) return;
  let html = '';
  (groups || []).forEach(group => {
    html += `<div class="event-month">${group.month}</div>`;
    group.items.forEach(ev => {
      html += `<div class="event-item">
        <span class="event-day">${ev.day}</span>
        <span class="event-name">${ev.name}</span>
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

/**
 * Opens the email verification gate.
 * @param {Function} onVerified     Called when the user passes — receives the verified email.
 * @param {string}   [context]      Optional label shown in the modal (e.g. app name).
 * @param {string[]} [allowedEmails] Optional per-card authorized list. Falls back
 *                                   to the global list when omitted/empty.
 */
function showEmailVerifyModal(onVerified, context, allowedEmails) {
  // Remove any existing instance
  const existing = document.getElementById('email-verify-modal');
  if (existing) existing.remove();

  const contextLine = context
    ? `<p class="ev-subtitle">Verify your identity to access <strong>${context}</strong>. Only authorized CHE DO Employees may proceed.</p>`
    : `<p class="ev-subtitle">This area is restricted to <strong>CHE Office of the Dean Employees</strong> only. Please verify your email to continue.</p>`;

  const modal = document.createElement('div');
  modal.id = 'email-verify-modal';
  modal.innerHTML = `
    <div class="ev-backdrop" onclick="closeEmailVerifyModal()"></div>
    <div class="ev-box" role="dialog" aria-modal="true" aria-labelledby="ev-title">
      <div class="ev-icon">🔐</div>
      <h2 class="ev-title" id="ev-title">Email Verification Required</h2>
      ${contextLine}
      <div class="ev-input-wrap">
        <label class="ev-label" for="ev-email-input">Your CHE DO Email Address</label>
        <input
          type="email"
          id="ev-email-input"
          class="ev-input"
          placeholder="yourname@up.edu.ph"
          autocomplete="email"
          spellcheck="false"
        />
        <div class="ev-error-msg" id="ev-error">
          <span>⚠️</span><span id="ev-error-text">That email is not on the authorized list.</span>
        </div>
      </div>
      <div class="ev-hint">
        Access is limited to <strong>authorized CHE DO Employees</strong> only.
        If you believe you should have access, contact the CHE office.
      </div>
      <div class="ev-actions">
        <button class="ev-btn cancel" onclick="closeEmailVerifyModal()">Cancel</button>
        <button class="ev-btn verify" id="ev-submit-btn" onclick="submitEmailVerify()">
          Verify &amp; Continue <span>→</span>
        </button>
      </div>
    </div>
  `;

  // Store callback + this card's authorized list
  modal._onVerified = onVerified;
  modal._allowedEmails = allowedEmails;
  document.body.appendChild(modal);

  // Keyboard handlers
  const input = modal.querySelector('#ev-email-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitEmailVerify();
    clearEmailError();
  });

  requestAnimationFrame(() => modal.classList.add('modal-visible'));
  setTimeout(() => input.focus(), 280);

  document.addEventListener('keydown', handleEmailVerifyKeydown);
}

function handleEmailVerifyKeydown(e) {
  if (e.key === 'Escape') closeEmailVerifyModal();
}

function closeEmailVerifyModal() {
  const modal = document.getElementById('email-verify-modal');
  if (!modal) return;
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.remove(), 250);
  document.removeEventListener('keydown', handleEmailVerifyKeydown);
}

function clearEmailError() {
  const input = document.getElementById('ev-email-input');
  const error = document.getElementById('ev-error');
  if (input) input.classList.remove('ev-error');
  if (error) error.classList.remove('show');
}

function submitEmailVerify() {
  const modal = document.getElementById('email-verify-modal');
  if (!modal) return;

  const input = document.getElementById('ev-email-input');
  const errorEl = document.getElementById('ev-error');
  const errorText = document.getElementById('ev-error-text');
  const email = (input?.value || '').trim();

  if (!email) {
    input.classList.add('ev-error');
    errorText.textContent = 'Please enter your email address.';
    errorEl.classList.add('show');
    input.focus();
    return;
  }

  if (!isValidChedoEmail(email, modal._allowedEmails)) {
    input.classList.add('ev-error');
    errorText.textContent = 'That email is not on the authorized list. Contact the CHE office if you need access.';
    errorEl.classList.add('show');
    input.focus();
    return;
  }

  // Passed — close and call callback
  const onVerified = modal._onVerified;
  closeEmailVerifyModal();
  if (typeof onVerified === 'function') onVerified(email);
}

/**
 * Called when the user clicks "CHE Office of the Dean" in the nav.
 * Shows email verification, then navigates to chedo.html on success.
 */
function openChedoPortal() {
  showEmailVerifyModal(() => {
    window.location.href = 'chedo.html';
  });
}

/**
 * Called by "Open App" buttons on chedo.html.
 * Shows a CHE DO restricted-access info modal first,
 * then email verification on Continue, then opens the app on success.
 */
function openChedoApp(el) {
  const link = (el.getAttribute('data-link') || '').trim();
  const card = el.closest('.app-card');
  const appName = card?.querySelector('.app-name')?.textContent || 'This application';

  // No real URL yet → Coming Soon (same as the public apps page).
  if (!link || link === '#' || link.startsWith('PASTE_')) {
    showComingSoonModal(appName);
    return false;
  }

  // Read THIS card's authorized email list from its data-emails attribute.
  // Comma-separated; whitespace and empty entries are ignored.
  // If the attribute is missing/empty, the global fallback list is used.
  const emailsAttr = card?.getAttribute('data-emails') || '';
  const allowedEmails = emailsAttr
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  showChedoRestrictedModal(appName, link, allowedEmails);
  return false;
}

/**
 * Shows a CHE DO-themed "Authorized Email Only" info modal.
 * On Continue → email verification gate → open app.
 */
function showChedoRestrictedModal(appName, link, allowedEmails) {
  const existing = document.getElementById('chedo-restricted-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'chedo-restricted-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeChedoRestrictedModal()"></div>
    <div class="modal-box chedo-modal-box" role="dialog" aria-modal="true" aria-labelledby="chedo-modal-title">
      <div class="modal-icon">🔐</div>
      <h2 class="modal-title chedo-modal-title" id="chedo-modal-title">CHE DO Restricted App</h2>
      <p class="modal-app-name chedo-modal-app-name">${appName}</p>
      <div class="modal-body">
        <p>This application is restricted to <strong>authorized CHE DO email accounts only</strong>.</p>
        <div class="modal-steps">
          <div class="modal-step">
            <span class="step-num chedo-step-num">1</span>
            <span>You will be asked to <strong>verify your authorized CHE DO email</strong> address</span>
          </div>
          <div class="modal-step">
            <span class="step-num chedo-step-num">2</span>
            <span>Make sure you are signed in with your <strong>authorized UP Google account</strong></span>
          </div>
          <div class="modal-step">
            <span class="step-num chedo-step-num">3</span>
            <span>If access is denied, contact the <strong>CHE Office of the Dean</strong> to request authorization</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick="closeChedoRestrictedModal()">Cancel</button>
        <button class="modal-btn continue chedo-continue-btn" onclick="proceedToChedoVerify('${appName.replace(/'/g, "\\'")}', '${link}')">
          Continue <span>→</span>
        </button>
      </div>
    </div>
  `;
  // Keep the per-card list on the element so Continue can hand it to the verify gate.
  modal._allowedEmails = allowedEmails;
  document.body.appendChild(modal);

  requestAnimationFrame(() => modal.classList.add('modal-visible'));
  document.addEventListener('keydown', handleChedoModalKeydown);
}

function handleChedoModalKeydown(e) {
  if (e.key === 'Escape') closeChedoRestrictedModal();
}

function closeChedoRestrictedModal() {
  const modal = document.getElementById('chedo-restricted-modal');
  if (!modal) return;
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.remove(), 250);
  document.removeEventListener('keydown', handleChedoModalKeydown);
}

function proceedToChedoVerify(appName, link) {
  // Grab this card's list before the modal is removed from the DOM.
  const modal = document.getElementById('chedo-restricted-modal');
  const allowedEmails = modal ? modal._allowedEmails : null;
  closeChedoRestrictedModal();
  showEmailVerifyModal(() => {
    window.open(link, '_blank', 'noopener,noreferrer');
  }, appName, allowedEmails);
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
