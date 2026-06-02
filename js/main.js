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
  const link = el.getAttribute('data-link');
  if (!link || link.startsWith('PASTE_')) {
    showToast('🔗 Link not yet configured. Replace the placeholder URL in the HTML file.');
    return false;
  }

  // Check if the card is restricted
  const card = el.closest('.app-card');
  const isRestricted = card && card.classList.contains('restricted');

  if (isRestricted) {
    const appName = card.querySelector('.app-name')?.textContent || 'this application';
    showRestrictedModal(appName, link);
  } else {
    window.open(link, '_blank', 'noopener,noreferrer');
  }
  return false;
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
// ▼▼▼ ADD OR REMOVE AUTHORIZED EMAILS HERE ▼▼▼
const CHEDO_ALLOWED_EMAILS = [
  'juan.delacruz@up.edu.ph',
  'maria.santos@uplb.edu.ph',
  // add more emails below this line...
];
// ▲▲▲ END OF EMAIL LIST ▲▲▲

function isValidChedoEmail(email) {
  const normalized = email.trim().toLowerCase();
  return CHEDO_ALLOWED_EMAILS.includes(normalized);
}

/**
 * Opens the email verification gate.
 * @param {Function} onVerified  Called when the user passes — receives the verified email.
 * @param {string}   [context]   Optional label shown in the modal (e.g. app name).
 */
function showEmailVerifyModal(onVerified, context) {
  // Remove any existing instance
  const existing = document.getElementById('email-verify-modal');
  if (existing) existing.remove();

  const contextLine = context
    ? `<p class="ev-subtitle">Verify your identity to access <strong>${context}</strong>. Only authorized CHE DO members may proceed.</p>`
    : `<p class="ev-subtitle">This area is restricted to <strong>CHE Office of the Dean members</strong> only. Please verify your email to continue.</p>`;

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
        Access is limited to <strong>authorized CHE DO members</strong> only.
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

  // Store callback
  modal._onVerified = onVerified;
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

  if (!isValidChedoEmail(email)) {
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
 * Shows email verification first, then the restricted-access confirmation on success.
 */
function openChedoApp(el) {
  const link = el.getAttribute('data-link');
  if (!link || link.startsWith('PASTE_')) {
    showToast('🔗 Link not yet configured. Replace the placeholder URL in the HTML file.');
    return false;
  }

  const card = el.closest('.app-card');
  const appName = card?.querySelector('.app-name')?.textContent || 'this application';

  showEmailVerifyModal(() => {
    showRestrictedModal(appName, link);
  }, appName);

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
