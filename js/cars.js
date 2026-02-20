/**
 * cars.js — KanataDrive
 * Car data fetching and DOM rendering.
 * Depends on: utils.js, api.js
 */


/* ─────────────────────────────────────────
   DATA FETCHING
───────────────────────────────────────── */

/**
 * Fetch car listings with optional filters.
 * @param {Object} [filters={}] — query params (make, model, year, price_min, price_max, etc.)
 * @returns {Promise<Array>}
 */
async function getCars(filters = {}) {
  return apiGet('/cars', filters);
}

/**
 * Fetch a single car by ID.
 * @param {string} id — car UUID
 * @returns {Promise<Object>}
 */
async function getSingleCar(id) {
  return apiGet(`/cars/${id}`);
}

/**
 * Create a new car listing (dealer, authenticated).
 * @param {Object} formData — car fields
 * @returns {Promise<Object>}
 */
async function createCar(formData) {
  return apiPost('/cars', formData, true);
}

/**
 * Update an existing car listing.
 * @param {string} id — car UUID
 * @param {Object} formData — updated car fields
 * @returns {Promise<Object>}
 */
async function updateCar(id, formData) {
  return apiPut(`/cars/${id}`, formData, true);
}

/**
 * Delete a car listing.
 * @param {string} id — car UUID
 * @returns {Promise<null>}
 */
async function deleteCar(id) {
  return apiDelete(`/cars/${id}`, true);
}

/**
 * Get all listings for the authenticated dealer.
 * @returns {Promise<Array>}
 */
async function getDealerCars() {
  return apiGet('/dealer/cars', {}, true);
}

/* ─────────────────────────────────────────
   RENDERING — CARD
───────────────────────────────────────── */

/**
 * Build a single car card DOM element.
 * @param {Object} car
 * @returns {HTMLElement}
 */
function buildCarCard(car) {
  const card = document.createElement('a');
  card.href = `/car?id=${car.id}`;
  card.setAttribute('data-kd', 'car-card');
  card.style.cssText = 'display:block;text-decoration:none;color:inherit;';

  const photoUrl = getImageUrl(car.main_photo, 'https://placehold.co/400x260?text=No+Photo');

  card.innerHTML = `
    <div data-kd="car-card-inner">
      <div data-kd="car-card-photo-wrap" style="position:relative;overflow:hidden;border-radius:12px 12px 0 0;">
        <img
          wized="car-photo"
          src="${photoUrl}"
          alt="${car.year} ${car.make} ${car.model}"
          style="width:100%;height:220px;object-fit:cover;display:block;"
          loading="lazy"
        />
        ${car.condition ? `<span data-kd="car-badge"
          style="position:absolute;top:12px;left:12px;background:#5720CD;color:#fff;font-size:12px;
          font-weight:600;padding:4px 10px;border-radius:20px;font-family:Satoshi,sans-serif;">
          ${car.condition}
        </span>` : ''}
        <button data-kd="favorite-btn" data-car-id="${car.id}"
          style="position:absolute;top:12px;right:12px;background:#fff;border:none;border-radius:50%;
          width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#121726" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div data-kd="car-card-body" style="padding:16px;">
        <div style="font-family:Satoshi,sans-serif;font-size:18px;font-weight:700;color:#121726;margin-bottom:4px;">
          ${car.year} ${car.make} ${car.model}
        </div>
        <div wized="item-price" style="font-size:20px;font-weight:800;color:#5720CD;margin-bottom:8px;">
          ${formatPrice(car.price)}
        </div>
        <div style="display:flex;gap:16px;font-size:13px;color:#555;font-family:Satoshi,sans-serif;flex-wrap:wrap;margin-bottom:8px;">
          <span wized="item-mileage">${formatMileage(car.mileage)}</span>
          <span>${car.transmission || ''}</span>
          <span>${car.fuel_type || ''}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#888;font-family:Satoshi,sans-serif;">
          <span wized="item-location">${car.carLocation || ''}</span>
          ${car.price_month ? `<span wized="item-monthly">${formatPrice(car.price_month)}/mo</span>` : ''}
        </div>
        ${car._dealer ? `<div wized="item-dealer" style="font-size:12px;color:#aaa;margin-top:4px;font-family:Satoshi,sans-serif;">
          ${car._dealer.dealerName || ''}
        </div>` : ''}
      </div>
    </div>
  `;

  return card;
}

/**
 * Render car cards into a container element.
 * Replaces existing content.
 * @param {Array} cars
 * @param {HTMLElement} container
 */
function renderCarCards(cars, container) {
  if (!container) return;
  container.innerHTML = '';

  if (!cars || cars.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 24px;color:#888;font-family:Satoshi,sans-serif;">
        No listings found. Try adjusting your filters.
      </div>
    `;
    return;
  }

  cars.forEach(car => {
    container.appendChild(buildCarCard(car));
  });
}

/* ─────────────────────────────────────────
   RENDERING — DETAIL PAGE
───────────────────────────────────────── */

/**
 * Populate the car detail page with data from a single car object.
 * Targets elements by wized="" and data-kd="" attributes.
 * @param {Object} car
 */
function renderCarDetail(car) {
  _setText('[data-kd="detail-title"]', `${car.year} ${car.make} ${car.model}`);
  _setText('[data-kd="detail-price"]', formatPrice(car.price));
  _setText('[data-kd="detail-monthly"]', car.price_month ? `${formatPrice(car.price_month)}/mo` : '');
  _setText('[data-kd="detail-mileage"]', formatMileage(car.mileage));
  _setText('[data-kd="detail-transmission"]', car.transmission || '');
  _setText('[data-kd="detail-fuel"]', car.fuel_type || '');
  _setText('[data-kd="detail-body"]', car.body_style || '');
  _setText('[data-kd="detail-color"]', car.color || '');
  _setText('[data-kd="detail-intcolor"]', car.intcolor || '');
  _setText('[data-kd="detail-engine"]', car.engineLi ? `${car.engineLi}L` : '');
  _setText('[data-kd="detail-condition"]', car.condition || '');
  _setText('[data-kd="detail-location"]', car.carLocation || '');
  _setText('[data-kd="detail-seats"]', car.seats ? `${car.seats} seats` : '');
  _setText('[data-kd="detail-vin"]', car.vin || '');
  _setText('[data-kd="detail-description"]', car.description || '');

  // Drivetrain (may be object or string)
  const drivetrain = car._drivetrain?.name || car.drivetrain || '';
  _setText('[data-kd="detail-drivetrain"]', drivetrain);

  // Main photo
  const mainImg = document.querySelector('[data-kd="detail-main-photo"]');
  if (mainImg) {
    mainImg.src = getImageUrl(car.main_photo, 'https://placehold.co/800x500?text=No+Photo');
    mainImg.alt = `${car.year} ${car.make} ${car.model}`;
  }

  // Gallery
  _renderGallery(car.gallery);

  // Features
  _renderFeatures(car.features);

  // Dealer info
  if (car._dealer) {
    _setText('[data-kd="detail-dealer-name"]', car._dealer.dealerName || '');
    _setText('[data-kd="detail-dealer-location"]', car._dealer.location || '');
    _setText('[data-kd="detail-dealer-phone"]', car._dealer.phone || '');

    const avatarEl = document.querySelector('[data-kd="detail-dealer-avatar"]');
    if (avatarEl) avatarEl.src = getImageUrl(car._dealer.dealerAvatar);

    const dealerLink = document.querySelector('[data-kd="detail-dealer-link"]');
    if (dealerLink) dealerLink.href = `/dealer?id=${car._dealer.id}`;
  }

  // Store car/dealer IDs for the inquiry form
  const inquiryForm = document.querySelector('[data-kd="inquiry-form"]');
  if (inquiryForm) {
    inquiryForm.setAttribute('data-car-id', car.id);
    inquiryForm.setAttribute('data-dealer-id', car.dealer_id);
  }
}

/**
 * Render the image gallery.
 * @param {Array} gallery — array of Xano image objects
 * @private
 */
function _renderGallery(gallery) {
  const container = document.querySelector('[data-kd="detail-gallery"]');
  if (!container || !gallery || gallery.length === 0) return;

  container.innerHTML = '';
  gallery.forEach((img, i) => {
    const thumb = document.createElement('img');
    thumb.src = getImageUrl(img);
    thumb.alt = `Gallery image ${i + 1}`;
    thumb.setAttribute('wized', 'gallery-image');
    thumb.style.cssText = 'width:100%;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;';
    thumb.addEventListener('click', () => {
      const mainImg = document.querySelector('[data-kd="detail-main-photo"]');
      if (mainImg) mainImg.src = thumb.src;
    });
    container.appendChild(thumb);
  });
}

/**
 * Render the features list.
 * @param {Array} features — array of { features_id, features_name }
 * @private
 */
function _renderFeatures(features) {
  const container = document.querySelector('[data-kd="detail-features"]');
  if (!container || !features || features.length === 0) return;

  container.innerHTML = '';
  features.forEach(f => {
    const tag = document.createElement('span');
    tag.setAttribute('data-kd', 'feature-tag');
    tag.textContent = f.features_name || f.feature_type || '';
    tag.style.cssText = `
      display:inline-block;padding:4px 12px;border-radius:20px;
      background:#f0eafb;color:#5720CD;font-size:13px;
      font-family:Satoshi,sans-serif;margin:4px;
    `;
    container.appendChild(tag);
  });
}

/**
 * Set text content of a queried element.
 * @param {string} selector
 * @param {string} text
 * @private
 */
function _setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

/* ─────────────────────────────────────────
   PAGE INIT
───────────────────────────────────────── */

/**
 * Initialize the car detail page.
 * Reads ?id= from URL, fetches car, renders detail.
 */
async function initCarDetailPage() {
  const id = getUrlParam('id');
  const container = document.querySelector('[data-kd="car-detail"]') || document.body;

  if (!id) {
    showError(container, 'Car not found.');
    return;
  }

  showLoading(container);
  try {
    const car = await getSingleCar(id);
    hideLoading(container);
    renderCarDetail(car);
  } catch (err) {
    hideLoading(container);
    showError(container, err.message || 'Failed to load car details.');
  }
}

/**
 * Initialize the catalog page.
 * @param {Object} [filters={}]
 */
async function initCatalogPage(filters = {}) {
  const container = document.querySelector('[data-kd="cars-list"]') ||
                    document.querySelector('[wized="cars-list"]');
  if (!container) return;

  showLoading(container);
  try {
    const cars = await getCars(filters);
    hideLoading(container);
    renderCarCards(cars, container);
  } catch (err) {
    hideLoading(container);
    showError(container, err.message || 'Failed to load listings.');
  }
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

function initCars() {
  // Car detail page — has [data-kd="car-detail"] or ?id= on a /car path
  const isDetailPage =
    document.querySelector('[data-kd="car-detail"]') ||
    (getUrlParam('id') && window.location.pathname.includes('/car'));

  if (isDetailPage) {
    initCarDetailPage();
    return;
  }

  // Catalog page — has [data-kd="cars-list"] or [wized="cars-list"]
  // If filters.js is also loaded it will call applyFilters() which calls getCars internally,
  // so only init here when filters.js is NOT present on the page.
  const hasCatalogContainer =
    document.querySelector('[data-kd="cars-list"]') ||
    document.querySelector('[wized="cars-list"]');

  if (hasCatalogContainer && typeof initFilters === 'undefined') {
    // filters.js not loaded — load cars directly
    initCatalogPage();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCars);
} else {
  initCars();
}

window.initCars = initCars;
window.initCatalogPage = initCatalogPage;
window.initCarDetailPage = initCarDetailPage;
