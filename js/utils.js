/**
 * utils.js — KanataDrive
 * Shared utilities: cookies, formatters, URL helpers, UI helpers
 * Loaded on every page. No external dependencies.
 */

/* ─────────────────────────────────────────
   COOKIES
───────────────────────────────────────── */

/**
 * Read a cookie value by name.
 * @param {string} name
 * @returns {string|null}
 */
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Set a cookie.
 * @param {string} name
 * @param {string} value
 * @param {number} [days=30] — expiry in days
 */
function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Delete a cookie by name.
 * @param {string} name
 */
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

/* ─────────────────────────────────────────
   FORMATTERS
───────────────────────────────────────── */

/**
 * Format a number as a CAD price string.
 * @param {number} num
 * @returns {string} e.g. "$26,500"
 */
function formatPrice(num) {
  if (num == null || isNaN(num)) return '—';
  return '$' + Number(num).toLocaleString('en-CA');
}

/**
 * Format a mileage number.
 * @param {number} num
 * @returns {string} e.g. "88,000 km"
 */
function formatMileage(num) {
  if (num == null || isNaN(num)) return '—';
  return Number(num).toLocaleString('en-CA') + ' km';
}

/**
 * Format a Unix timestamp (seconds or ms) or ISO date string.
 * @param {number|string} timestamp
 * @returns {string} e.g. "June 5, 2025"
 */
function formatDate(timestamp) {
  if (!timestamp) return '—';
  // Xano returns timestamps in milliseconds
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ─────────────────────────────────────────
   URL HELPERS
───────────────────────────────────────── */

/**
 * Read a query parameter from the current URL.
 * @param {string} name
 * @returns {string|null}
 */
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Set / update query params in the URL without reloading the page.
 * Pass null or '' as value to remove a param.
 * @param {Object} params — { key: value, ... }
 */
function setUrlParams(params) {
  const sp = new URLSearchParams(window.location.search);
  Object.entries(params).forEach(([key, val]) => {
    if (val === null || val === undefined || val === '') {
      sp.delete(key);
    } else {
      sp.set(key, String(val));
    }
  });
  const query = sp.toString();
  const newUrl = window.location.pathname + (query ? '?' + query : '');
  window.history.replaceState({}, '', newUrl);
}

/* ─────────────────────────────────────────
   UI STATE HELPERS
───────────────────────────────────────── */

/**
 * Show a loading state on an element (dims + blocks interaction).
 * @param {HTMLElement} el
 */
function showLoading(el) {
  if (!el) return;
  el.setAttribute('data-kd-loading', 'true');
  el.style.opacity = '0.5';
  el.style.pointerEvents = 'none';
}

/**
 * Remove loading state from an element.
 * @param {HTMLElement} el
 */
function hideLoading(el) {
  if (!el) return;
  el.removeAttribute('data-kd-loading');
  el.style.opacity = '';
  el.style.pointerEvents = '';
}

/**
 * Show an error message inside an element.
 * Reuses existing [data-kd="error-msg"] node if present.
 * @param {HTMLElement} el
 * @param {string} message
 */
function showError(el, message) {
  if (!el) return;

  let errorEl = el.querySelector('[data-kd="error-msg"]');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.setAttribute('data-kd', 'error-msg');
    errorEl.style.cssText =
      'color:#c0392b;font-size:14px;margin-top:8px;padding:8px 12px;background:#fdf0ef;border-radius:6px;';
    el.appendChild(errorEl);
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';

  // Hide success if visible
  const successEl = el.querySelector('[data-kd="success-msg"]');
  if (successEl) successEl.style.display = 'none';
}

/**
 * Show a success message inside an element.
 * Reuses existing [data-kd="success-msg"] node if present.
 * @param {HTMLElement} el
 * @param {string} message
 */
function showSuccess(el, message) {
  if (!el) return;

  let successEl = el.querySelector('[data-kd="success-msg"]');
  if (!successEl) {
    successEl = document.createElement('div');
    successEl.setAttribute('data-kd', 'success-msg');
    successEl.style.cssText =
      'color:#1a7a4a;font-size:14px;margin-top:8px;padding:8px 12px;background:#edfaf3;border-radius:6px;';
    el.appendChild(successEl);
  }
  successEl.textContent = message;
  successEl.style.display = 'block';

  // Hide error if visible
  const errorEl = el.querySelector('[data-kd="error-msg"]');
  if (errorEl) errorEl.style.display = 'none';
}

/* ─────────────────────────────────────────
   IMAGE HELPERS
───────────────────────────────────────── */

/**
 * Safely get the URL from a Xano image object.
 * Always use this instead of imageObj.url directly.
 * @param {Object|null} imageObj — Xano image object
 * @param {string} [fallback=''] — URL to use if no image
 * @returns {string}
 */
function getImageUrl(imageObj, fallback = '') {
  return imageObj && imageObj.url ? imageObj.url : fallback;
}

/* ─────────────────────────────────────────
   MISC
───────────────────────────────────────── */

/**
 * Truncate a string to a max length with ellipsis.
 * @param {string} str
 * @param {number} [max=100]
 * @returns {string}
 */
function truncate(str, max = 100) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} [delay=300] — ms
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
