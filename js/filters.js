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
  // Text search
  search: '',

  // Multi-value filters (arrays → comma-joined for API)
  make: [],          // array of make name strings
  model: [],         // array of model name strings
  year: [],          // array of integers

  // Range filters
  price_min: '',
  price_max: '',
  mileage_min: '',
  mileage_max: '',

  // Single-value filters
  body_style: '',
  fuel_type: '',
  transmission: '',
  condition: '',
  drivetrain: '',

  // Feature IDs (array of strings)
  features: [],

  // Sorting
  sort_field: '',      // price | year | mileage | created_at
  sort_direction: '',  // asc | desc

  // Pagination
  current_page: 1,
  per_page: 20,
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
        ${filterState.make.includes(make.name) ? 'checked' : ''}
        style="accent-color:#5720CD;width:16px;height:16px;">
      ${make.name}
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!filterState.make.includes(make.name)) filterState.make.push(make.name);
      } else {
        filterState.make = filterState.make.filter(m => m !== make.name);
      }
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

  const container = document.querySelector('[data-kd="cars-list"]') ||
                    document.querySelector('[wized="cars-list"]');
  if (!container) return;

  // Build API params — skip empty/default values
  const params = {};

  // Text search
  if (filterState.search) params.search = filterState.search;

  // Array params → comma-joined strings
  if (filterState.make.length)     params.make     = filterState.make.join(',');
  if (filterState.model.length)    params.model    = filterState.model.join(',');
  if (filterState.year.length)     params.year     = filterState.year.join(',');
  if (filterState.features.length) params.features = filterState.features.join(',');

  // Range params → integers
  if (filterState.price_min)    params.price_min    = Number(filterState.price_min);
  if (filterState.price_max)    params.price_max    = Number(filterState.price_max);
  if (filterState.mileage_min)  params.mileage_min  = Number(filterState.mileage_min);
  if (filterState.mileage_max)  params.mileage_max  = Number(filterState.mileage_max);

  // Single-value text params
  if (filterState.body_style)    params.body_style    = filterState.body_style;
  if (filterState.fuel_type)     params.fuel_type     = filterState.fuel_type;
  if (filterState.transmission)  params.transmission  = filterState.transmission;
  if (filterState.condition)     params.condition     = filterState.condition;
  if (filterState.drivetrain)    params.drivetrain    = filterState.drivetrain;

  // Sort
  if (filterState.sort_field)     params.sort_field     = filterState.sort_field;
  if (filterState.sort_direction) params.sort_direction = filterState.sort_direction;

  // Pagination (always send)
  params.current_page = filterState.current_page || 1;
  params.per_page     = filterState.per_page || 20;

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

  let hasChips = false;

  // Array filters — one chip per array showing count or values
  const arrayFilters = [
    { key: 'make',  label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'year',  label: 'Year' },
  ];
  arrayFilters.forEach(({ key, label }) => {
    const arr = filterState[key];
    if (!arr || arr.length === 0) return;
    hasChips = true;
    const display = arr.length === 1 ? `${label}: ${arr[0]}` : `${label} (${arr.length})`;
    container.appendChild(_buildChip(display, () => {
      filterState[key] = [];
      applyFilters();
    }));
  });

  // Scalar filters
  const scalarLabels = {
    search:       'Search',
    price_min:    'Price from',
    price_max:    'Price to',
    mileage_min:  'Min km',
    mileage_max:  'Max km',
    body_style:   'Body',
    fuel_type:    'Fuel',
    transmission: 'Transmission',
    condition:    'Condition',
    drivetrain:   'Drivetrain',
    sort_field:   'Sort',
  };
  Object.entries(scalarLabels).forEach(([key, label]) => {
    const val = filterState[key];
    if (!val) return;
    hasChips = true;
    container.appendChild(_buildChip(`${label}: ${val}`, () => {
      filterState[key] = '';
      applyFilters();
    }));
  });

  // Features
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
  // Arrays
  filterState.make     = [];
  filterState.model    = [];
  filterState.year     = [];
  filterState.features = [];

  // Scalars
  filterState.search        = '';
  filterState.price_min     = '';
  filterState.price_max     = '';
  filterState.mileage_min   = '';
  filterState.mileage_max   = '';
  filterState.body_style    = '';
  filterState.fuel_type     = '';
  filterState.transmission  = '';
  filterState.condition     = '';
  filterState.drivetrain    = '';
  filterState.sort_field    = '';
  filterState.sort_direction = '';

  // Reset pagination
  filterState.current_page  = 1;
  filterState.per_page      = 20;

  // Reset DOM inputs
  document.querySelectorAll('[data-kd="make-checkbox"], [data-kd="feature-checkbox"]')
    .forEach(cb => { cb.checked = false; });
  document.querySelectorAll('[data-kd="filter-select"]')
    .forEach(sel => { sel.value = ''; });
  document.querySelectorAll('[data-kd="filter-input"]')
    .forEach(inp => { inp.value = ''; });

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
  const arrayKeys = ['make', 'model', 'year', 'features'];
  const skipKeys  = ['current_page', 'per_page']; // don't clutter URL with pagination defaults
  const params = {};

  Object.entries(filterState).forEach(([key, val]) => {
    if (skipKeys.includes(key)) return;
    if (arrayKeys.includes(key)) {
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
  const arrayKeys = ['make', 'model', 'year', 'features'];

  Object.keys(filterState).forEach(key => {
    const val = getUrlParam(key);
    if (val === null) return;
    if (arrayKeys.includes(key)) {
      filterState[key] = val ? val.split(',') : [];
    } else if (key === 'current_page' || key === 'per_page') {
      filterState[key] = val ? Number(val) : filterState[key];
    } else {
      filterState[key] = val;
    }
  });
}

/* ─────────────────────────────────────────
   STATIC FILTER BINDING
───────────────────────────────────────── */

/**
 * Bind static filter inputs (selects, range inputs, search, sort).
 * Supports:
 *   [wized="filter_search_input"]           — text search
 *   [data-kd="filter-select"][data-filter-key="..."]  — single-value selects
 *   [data-kd="filter-input"][data-filter-key="..."]   — range/text inputs
 *   [data-kd="sort-select"]                — sort_field + sort_direction combined
 *   [data-kd="per-page-select"]            — per_page
 * @private
 */
function _bindStaticFilters() {
  // ── Search ──────────────────────────────────────────────────────────────────
  const searchInput = document.querySelector('[wized="filter_search_input"]');
  if (searchInput) {
    const debouncedSearch = debounce(() => {
      filterState.search = searchInput.value.trim();
      filterState.current_page = 1;
      applyFilters();
    }, 400);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // ── Generic selects: data-kd="filter-select" data-filter-key="field" ───────
  document.querySelectorAll('[data-kd="filter-select"]').forEach(select => {
    const key = select.getAttribute('data-filter-key');
    if (!key) return;
    // Restore value
    if (Array.isArray(filterState[key])) {
      // multi-value stored as array — not typical for a single select, skip
    } else if (filterState[key]) {
      select.value = filterState[key];
    }
    select.addEventListener('change', () => {
      filterState[key] = select.value;
      filterState.current_page = 1;
      applyFilters();
    });
  });

  // ── Generic inputs: data-kd="filter-input" data-filter-key="field" ─────────
  document.querySelectorAll('[data-kd="filter-input"]').forEach(input => {
    const key = input.getAttribute('data-filter-key');
    if (!key) return;
    if (filterState[key]) input.value = filterState[key];
    input.addEventListener('change', () => {
      filterState[key] = input.value.trim();
      filterState.current_page = 1;
      applyFilters();
    });
  });

  // ── Sort select: value format "field:direction" e.g. "price:asc" ───────────
  const sortSelect = document.querySelector('[data-kd="sort-select"]');
  if (sortSelect) {
    // Restore
    if (filterState.sort_field) {
      sortSelect.value = `${filterState.sort_field}:${filterState.sort_direction || 'asc'}`;
    }
    sortSelect.addEventListener('change', () => {
      const [field, direction] = sortSelect.value.split(':');
      filterState.sort_field     = field || '';
      filterState.sort_direction = direction || '';
      filterState.current_page   = 1;
      applyFilters();
    });
  }

  // ── Per-page select ─────────────────────────────────────────────────────────
  const perPageSelect = document.querySelector('[data-kd="per-page-select"]');
  if (perPageSelect) {
    perPageSelect.value = filterState.per_page;
    perPageSelect.addEventListener('change', () => {
      filterState.per_page     = Number(perPageSelect.value) || 20;
      filterState.current_page = 1;
      applyFilters();
    });
  }

  // ── Clear all button ────────────────────────────────────────────────────────
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

function initFiltersPage() {
  // Run only when a catalog container exists on the page
  const hasCatalog =
    document.querySelector('[data-kd="cars-list"]') ||
    document.querySelector('[wized="cars-list"]');

  if (!hasCatalog) return;

  initFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFiltersPage);
} else {
  initFiltersPage();
}

window.initFilters = initFilters;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
