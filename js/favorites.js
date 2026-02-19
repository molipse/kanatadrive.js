/**
 * favorites.js — KanataDrive
 * localStorage-based favorites for buyers (no auth required).
 * Depends on: utils.js, api.js, cars.js
 */
if (window.__KD_FAVORITES_LOADED__) { /* already loaded, skip */ return; }
window.__KD_FAVORITES_LOADED__ = true;


const FAVORITES_KEY = 'kd_favorites';

/* ─────────────────────────────────────────
   STORAGE HELPERS
───────────────────────────────────────── */

/**
 * Get all saved favorite car IDs from localStorage.
 * @returns {string[]}
 */
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Check if a car is in favorites.
 * @param {string} carId
 * @returns {boolean}
 */
function isFavorite(carId) {
  return getFavorites().includes(String(carId));
}

/**
 * Add a car to favorites.
 * @param {string} carId
 */
function addFavorite(carId) {
  const favs = getFavorites();
  const id = String(carId);
  if (!favs.includes(id)) {
    favs.push(id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  }
  updateFavoriteButtons();
}

/**
 * Remove a car from favorites.
 * @param {string} carId
 */
function removeFavorite(carId) {
  const id = String(carId);
  const favs = getFavorites().filter(f => f !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  updateFavoriteButtons();
}

/**
 * Toggle a car in/out of favorites.
 * @param {string} carId
 */
function toggleFavorite(carId) {
  isFavorite(carId) ? removeFavorite(carId) : addFavorite(carId);
}

/* ─────────────────────────────────────────
   RENDER
───────────────────────────────────────── */

/**
 * Fetch favorited cars from Xano and render them.
 * Target container: [data-kd="favorites-list"]
 */
async function renderFavorites() {
  const container = document.querySelector('[data-kd="favorites-list"]');
  if (!container) return;

  const ids = getFavorites();

  if (ids.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px;color:#888;font-family:Satoshi,sans-serif;">
        You haven't saved any listings yet.
        <br><br>
        <a href="/cars" style="color:#5720CD;font-weight:600;">Browse listings</a>
      </div>
    `;
    return;
  }

  showLoading(container);
  try {
    // Fetch each car — run in parallel
    const results = await Promise.allSettled(ids.map(id => getSingleCar(id)));
    const cars = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    hideLoading(container);
    renderCarCards(cars, container);
    updateFavoriteButtons();
  } catch (err) {
    hideLoading(container);
    showError(container, 'Failed to load favorites.');
  }
}

/**
 * Update all favorite (heart) buttons on the current page
 * to reflect the current localStorage state.
 */
function updateFavoriteButtons() {
  document.querySelectorAll('[data-kd="favorite-btn"]').forEach(btn => {
    const carId = btn.getAttribute('data-car-id');
    if (!carId) return;

    const active = isFavorite(carId);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');

    const svg = btn.querySelector('svg path');
    if (svg) {
      svg.setAttribute('fill', active ? '#5720CD' : 'none');
      svg.setAttribute('stroke', active ? '#5720CD' : '#121726');
    }
    btn.title = active ? 'Remove from saved' : 'Save listing';
  });
}

/* ─────────────────────────────────────────
   EVENT DELEGATION
───────────────────────────────────────── */

/**
 * Attach click listeners to all favorite buttons via event delegation.
 * Call this once on DOMContentLoaded for pages with car cards.
 * Also handles dynamically injected cards.
 * @param {HTMLElement} [root=document] — root element to delegate from
 */
function initFavoriteButtons(root = document) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-kd="favorite-btn"]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation(); // prevent card <a> navigation

    const carId = btn.getAttribute('data-car-id');
    if (carId) toggleFavorite(carId);
  });

  // Set initial state
  updateFavoriteButtons();
}

/**
 * Show the saved count in [data-kd="favorites-count"] elements.
 */
function updateFavoritesCount() {
  const count = getFavorites().length;
  document.querySelectorAll('[data-kd="favorites-count"]').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Always update the count badge in the nav (present on all pages)
  updateFavoritesCount();

  // Attach click delegation for heart buttons on any page with car cards
  const hasCards =
    document.querySelector('[data-kd="favorite-btn"]') ||
    document.querySelector('[data-kd="cars-list"]') ||
    document.querySelector('[wized="cars-list"]') ||
    document.querySelector('[data-kd="car-detail"]');

  if (hasCards) {
    initFavoriteButtons();
  }

  // Favorites page — has [data-kd="favorites-list"]
  if (document.querySelector('[data-kd="favorites-list"]')) {
    renderFavorites();
  }
});
