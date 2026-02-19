/**
 * filters.js — KanataDrive
 * Filter UI, state management, and URL persistence for the car catalog.
 * Depends on: utils.js, api.js, cars.js
 */

/* ─────────────────────────────────────────
   FILTER STATE
───────────────────────────────────────── */

/**
 * Central filter state object.
 * All active filter values live here.
 * @type {Object}
 */
const filterState = {
  search: '',
  make: '',
  model: '',
  year_min: '',
  year_max: '',
  price_min: '',
  price_max: '',
  mileage_max: '',
  body_style: '',
  fuel_type: '',
  transmission: '',
  condition: '',
  drivetrain: '',
  features: [],    // array of feature IDs
};

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */

/**
 * Initialize all filters: load remote data, restore URL state, bind events.
 */
async function initFilters() {
  _restoreFromUrl();

  try {
    const [makes, drivetrains, features] = await Promise.all([
      apiGet('/make'),
      apiGet('/drivetrain'),
      apiGet('/features'),
    ]);

    renderMakeCheckboxes(makes);
    renderDrivetrainOptions(drivetrains);
    renderFeatureCheckboxes(features);
  } catch (err) {
    // Filter load failure is non-critical — log for debugging
  }

  _bindStaticFilters();
  _updateSearchInput();
  applyFilters();
}

/* ─────────────────────────────────────────
   RENDER FILTER INPUTS
───────────────────────────────────────── */

/**
 * Render make checkboxes into [data-kd="make-filter-list"].
 * @param {Array<{id: number, name: string}>} makes
 */
function renderMakeCheckboxes(makes) {
  const container = document.querySelector('[data-kd="make-filter-list"]');
  if (!container) return;

  container.innerHTML = '';
  makes.forEach(make => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-family:Satoshi,sans-serif;font-size:14px;padding:4px 0;';
    label.innerHTML = `
      <input type="checkbox" data-kd="make-checkbox" value="${make.name}"
        ${filterState.make === make.name ? 'checked' : ''}
        style="accent-color:#5720CD;width:16px;height:16px;">
      ${make.name}
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      filterState.make = e.target.checked ? make.name : '';
      // Uncheck other makes
      container.querySelectorAll('[data-kd="make-checkbox"]').forEach(cb => {
        if (cb !== e.target) cb.checked = false;
      });
      applyFilters();
    });
    container.appendChild(label);
  });
}

/**
 * Render drivetrain <select> options into [data-kd="drivetrain-filter"].
 * @param {Array<{id: number, name: string}>} drivetrains
 */
function renderDrivetrainOptions(drivetrains) {
  const select = document.querySelector('[data-kd="drivetrain-filter"]');
  if (!select) return;

  select.innerHTML = '<option value="">Any Drivetrain</option>';
  drivetrains.forEach(dt => {
    const option = document.createElement('option');
    option.value = dt.id;
    option.textContent = dt.name;
    if (filterState.drivetrain === String(dt.id)) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    filterState.drivetrain = select.value;
    applyFilters();
  });
}

/**
 * Render feature checkboxes into [data-kd="features-filter-list"].
 * @param {Array<{id: number, feature_type: string}>} features
 */
function renderFeatureCheckboxes(features) {
  const container = document.querySelector('[data-kd="features-filter-list"]');
  if (!container) return;

  container.innerHTML = '';
  features.forEach(feature => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-family:Satoshi,sans-serif;font-size:14px;padding:4px 0;';
    label.innerHTML = `
      <input type="checkbox" data-kd="feature-checkbox" value="${feature.id}"
        ${filterState.features.includes(String(feature.id)) ? 'checked' : ''}
        style="accent-color:#5720CD;width:16px;height:16px;">
      ${feature.feature_type}
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      const val = String(feature.id);
      if (e.target.checked) {
        if (!filterState.features.includes(val)) filterState.features.push(val);
      } else {
        filterState.features = filterState.features.filter(id => id !== val);
      }
      applyFilters();
    });
    container.appendChild(label);
  });
}

/* ─────────────────────────────────────────
   APPLY FILTERS
───────────────────────────────────────── */

/**
 * Collect current filter state → fetch cars → render cards.
 * Also persists state to URL.
 */
async function applyFilters() {
  _persistToUrl();
  renderFilterChips();

  const container = document.querySelector('[data-kd="cars-list"]');
  if (!container) return;

  // Build params — skip empty values
  const params = {};
  Object.entries(filterState).forEach(([key, val]) => {
    if (key === 'features') {
      if (val.length > 0) params.features = val.join(',');
    } else if (val !== '' && val !== null) {
      params[key] = val;
    }
  });

  showLoading(container);
  try {
    const cars = await getCars(params);
    hideLoading(container);
    renderCarCards(cars, container);
  } catch (err) {
    hideLoading(container);
    showError(container, err.message || 'Failed to load listings.');
  }
}

/* ─────────────────────────────────────────
   FILTER CHIPS
───────────────────────────────────────── */

/**
 * Render active filter chips into [data-kd="filter-chips"].
 */
function renderFilterChips() {
  const container = document.querySelector('[data-kd="filter-chips"]');
  if (!container) return;

  container.innerHTML = '';

  const labels = {
    search: 'Search',
    make: 'Make',
    model: 'Model',
    year_min: 'Year from',
    year_max: 'Year to',
    price_min: 'Price from',
    price_max: 'Price to',
    mileage_max: 'Max km',
    body_style: 'Body',
    fuel_type: 'Fuel',
    transmission: 'Transmission',
    condition: 'Condition',
    drivetrain: 'Drivetrain',
  };

  let hasChips = false;

  Object.entries(labels).forEach(([key, label]) => {
    const val = filterState[key];
    if (!val) return;
    hasChips = true;
    container.appendChild(_buildChip(`${label}: ${val}`, () => {
      filterState[key] = '';
      applyFilters();
    }));
  });

  if (filterState.features.length > 0) {
    hasChips = true;
    container.appendChild(_buildChip(`Features (${filterState.features.length})`, () => {
      filterState.features = [];
      applyFilters();
    }));
  }

  // Show/hide clear-all
  const clearAll = document.querySelector('[data-kd="filter-clear-all"]');
  if (clearAll) clearAll.style.display = hasChips ? 'inline-flex' : 'none';
}

/**
 * Build a single chip element.
 * @param {string} text
 * @param {Function} onRemove
 * @returns {HTMLElement}
 * @private
 */
function _buildChip(text, onRemove) {
  const chip = document.createElement('span');
  chip.style.cssText = `
    display:inline-flex;align-items:center;gap:6px;
    background:#f0eafb;color:#5720CD;
    padding:4px 10px;border-radius:20px;
    font-size:13px;font-family:Satoshi,sans-serif;
  `;
  chip.innerHTML = `${text} <button style="background:none;border:none;cursor:pointer;color:#5720CD;font-size:16px;line-height:1;padding:0;">×</button>`;
  chip.querySelector('button').addEventListener('click', onRemove);
  return chip;
}

/* ─────────────────────────────────────────
   RESET
───────────────────────────────────────── */

/**
 * Clear all active filters and re-fetch.
 */
function resetFilters() {
  Object.keys(filterState).forEach(key => {
    filterState[key] = key === 'features' ? [] : '';
  });

  // Reset all filter inputs
  document.querySelectorAll('[data-kd="make-checkbox"], [data-kd="feature-checkbox"]')
    .forEach(cb => { cb.checked = false; });
  document.querySelectorAll('[data-kd="filter-select"]')
    .forEach(sel => { sel.value = ''; });

  const searchInput = document.querySelector('[wized="filter_search_input"]');
  if (searchInput) searchInput.value = '';

  applyFilters();
}

/* ─────────────────────────────────────────
   URL PERSISTENCE
───────────────────────────────────────── */

/**
 * Write current filterState to URL query params.
 * @private
 */
function _persistToUrl() {
  const params = {};
  Object.entries(filterState).forEach(([key, val]) => {
    if (key === 'features') {
      params[key] = val.length > 0 ? val.join(',') : null;
    } else {
      params[key] = val || null;
    }
  });
  setUrlParams(params);
}

/**
 * Restore filterState from URL query params on page load.
 * @private
 */
function _restoreFromUrl() {
  Object.keys(filterState).forEach(key => {
    const val = getUrlParam(key);
    if (val === null) return;
    if (key === 'features') {
      filterState.features = val ? val.split(',') : [];
    } else {
      filterState[key] = val;
    }
  });
}

/* ─────────────────────────────────────────
   STATIC FILTER BINDING
───────────────────────────────────────── */

/**
 * Bind static filter inputs (selects, range inputs, search).
 * @private
 */
function _bindStaticFilters() {
  // Search input
  const searchInput = document.querySelector('[wized="filter_search_input"]');
  if (searchInput) {
    const debouncedSearch = debounce(() => {
      filterState.search = searchInput.value.trim();
      applyFilters();
    }, 400);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // Generic filter selects with data-kd="filter-select" data-filter-key="..."
  document.querySelectorAll('[data-kd="filter-select"]').forEach(select => {
    const key = select.getAttribute('data-filter-key');
    if (!key) return;
    if (filterState[key]) select.value = filterState[key];
    select.addEventListener('change', () => {
      filterState[key] = select.value;
      applyFilters();
    });
  });

  // Generic filter inputs (price range, year, mileage)
  document.querySelectorAll('[data-kd="filter-input"]').forEach(input => {
    const key = input.getAttribute('data-filter-key');
    if (!key) return;
    if (filterState[key]) input.value = filterState[key];
    input.addEventListener('change', () => {
      filterState[key] = input.value.trim();
      applyFilters();
    });
  });

  // Clear all button
  const clearAll = document.querySelector('[data-kd="filter-clear-all"]');
  if (clearAll) {
    clearAll.style.display = 'none';
    clearAll.addEventListener('click', resetFilters);
  }
}

/**
 * Populate the search input from filterState on init.
 * @private
 */
function _updateSearchInput() {
  const searchInput = document.querySelector('[wized="filter_search_input"]');
  if (searchInput && filterState.search) searchInput.value = filterState.search;
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Run only when a catalog container exists on the page
  const hasCatalog =
    document.querySelector('[data-kd="cars-list"]') ||
    document.querySelector('[wized="cars-list"]');

  if (!hasCatalog) return;

  initFilters();
});
