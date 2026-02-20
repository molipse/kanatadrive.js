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

  // Multi-value filters (arrays — serialised to comma strings for the API)
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
  } catch (_err) {
    // Filter list load failure is non-critical — UI still works without it
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
      filterState.current_page = 1;
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
    filterState.current_page = 1;
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
      filterState.current_page = 1;
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
 * Also persists state to URL and updates the active-filter count badge.
 */
async function applyFilters() {
  _persistToUrl();
  renderFilterChips();
  _updateFilterCount();

  const container = document.querySelector('[data-kd="cars-list"]') ||
                    document.querySelector('[wized="cars-list"]');
  if (!container) return;

  // Build API params — only include keys with actual values.
  // Arrays are comma-joined so apiGet's URLSearchParams.set() sends them
  // as a single ?key=val1,val2 param, which Xano parses as a list.
  const params = {};

  // Text search
  if (filterState.search) params.search = filterState.search;

  // Array params → comma-joined strings (never send empty arrays)
  if (filterState.make.length)     params.make     = filterState.make.join(',');
  if (filterState.model.length)    params.model    = filterState.model.join(',');
  if (filterState.year.length)     params.year     = filterState.year.join(',');
  if (filterState.features.length) params.features = filterState.features.join(',');

  // Range params — cast to Number, skip if falsy/zero
  if (filterState.price_min)   params.price_min   = Number(filterState.price_min);
  if (filterState.price_max)   params.price_max   = Number(filterState.price_max);
  if (filterState.mileage_min) params.mileage_min = Number(filterState.mileage_min);
  if (filterState.mileage_max) params.mileage_max = Number(filterState.mileage_max);

  // Single-value text params
  if (filterState.body_style)   params.body_style   = filterState.body_style;
  if (filterState.fuel_type)    params.fuel_type    = filterState.fuel_type;
  if (filterState.transmission) params.transmission = filterState.transmission;
  if (filterState.condition)    params.condition    = filterState.condition;
  if (filterState.drivetrain)   params.drivetrain   = filterState.drivetrain;

  // Sort — only include when both parts are set
  if (filterState.sort_field)     params.sort_field     = filterState.sort_field;
  if (filterState.sort_direction) params.sort_direction = filterState.sort_direction;

  // Pagination — always send explicit values
  params.current_page = filterState.current_page;
  params.per_page     = filterState.per_page;

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
   FILTER COUNT BADGE
───────────────────────────────────────── */

/**
 * Update [data-kd="filter-count"] with the number of active filters.
 * Hides the badge when count is zero.
 * @private
 */
function _updateFilterCount() {
  const badge = document.querySelector('[data-kd="filter-count"]');
  if (!badge) return;

  let count = 0;

  // Each non-empty array counts as one active filter
  if (filterState.make.length)     count++;
  if (filterState.model.length)    count++;
  if (filterState.year.length)     count++;
  if (filterState.features.length) count++;

  // Each non-empty scalar (excluding pagination and sort_direction which pairs with sort_field)
  const scalarKeys = [
    'search', 'price_min', 'price_max', 'mileage_min', 'mileage_max',
    'body_style', 'fuel_type', 'transmission', 'condition', 'drivetrain',
    'sort_field',
  ];
  scalarKeys.forEach(key => { if (filterState[key]) count++; });

  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
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

  // ── Array filters — one chip per field ──────────────────────────────────────
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
      filterState.current_page = 1;
      _syncCheckboxes(key);
      applyFilters();
    }));
  });

  // ── Scalar filters ───────────────────────────────────────────────────────────
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
      // sort_field and sort_direction are paired — clear both
      if (key === 'sort_field') {
        filterState.sort_direction = '';
        const sortSelect = document.querySelector('[data-kd="sort-select"]');
        if (sortSelect) sortSelect.value = '';
      }
      // Clear the corresponding DOM input/select
      _syncInputForKey(key);
      filterState.current_page = 1;
      applyFilters();
    }));
  });

  // ── Features ─────────────────────────────────────────────────────────────────
  if (filterState.features.length > 0) {
    hasChips = true;
    container.appendChild(_buildChip(`Features (${filterState.features.length})`, () => {
      filterState.features = [];
      filterState.current_page = 1;
      document.querySelectorAll('[data-kd="feature-checkbox"]')
        .forEach(cb => { cb.checked = false; });
      applyFilters();
    }));
  }

  // ── Show/hide clear-all button ───────────────────────────────────────────────
  const clearAll = document.querySelector('[data-kd="filter-clear-all"]');
  if (clearAll) clearAll.style.display = hasChips ? 'inline-flex' : 'none';
}

/**
 * Build a single removable chip element.
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
  chip.innerHTML = `${text} <button style="background:none;border:none;cursor:pointer;color:#5720CD;font-size:16px;line-height:1;padding:0;" aria-label="Remove filter">×</button>`;
  chip.querySelector('button').addEventListener('click', onRemove);
  return chip;
}

/**
 * Uncheck all DOM checkboxes for a given array filter key (make / model / year).
 * @param {string} key
 * @private
 */
function _syncCheckboxes(key) {
  const selector = key === 'make' ? '[data-kd="make-checkbox"]' : null;
  if (selector) {
    document.querySelectorAll(selector).forEach(cb => { cb.checked = false; });
  }
}

/**
 * Reset the DOM input or select that corresponds to a scalar filter key.
 * @param {string} key
 * @private
 */
function _syncInputForKey(key) {
  // Generic filter-select
  const select = document.querySelector(`[data-kd="filter-select"][data-filter-key="${key}"]`);
  if (select) { select.value = ''; return; }

  // Generic filter-input
  const input = document.querySelector(`[data-kd="filter-input"][data-filter-key="${key}"]`);
  if (input) { input.value = ''; return; }

  // Search input (special wized attribute)
  if (key === 'search') {
    const searchInput = document.querySelector('[wized="filter_search_input"]');
    if (searchInput) searchInput.value = '';
  }
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

  // Pagination
  filterState.current_page = 1;
  filterState.per_page     = 20;

  // Reset DOM — checkboxes
  document.querySelectorAll('[data-kd="make-checkbox"], [data-kd="feature-checkbox"]')
    .forEach(cb => { cb.checked = false; });

  // Reset DOM — generic selects and inputs
  document.querySelectorAll('[data-kd="filter-select"]')
    .forEach(sel => { sel.value = ''; });
  document.querySelectorAll('[data-kd="filter-input"]')
    .forEach(inp => { inp.value = ''; });

  // Reset DOM — dedicated controls
  const searchInput = document.querySelector('[wized="filter_search_input"]');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.querySelector('[data-kd="sort-select"]');
  if (sortSelect) sortSelect.value = '';

  const perPageSelect = document.querySelector('[data-kd="per-page-select"]');
  if (perPageSelect) perPageSelect.value = String(filterState.per_page);

  const drivetrainSelect = document.querySelector('[data-kd="drivetrain-filter"]');
  if (drivetrainSelect) drivetrainSelect.value = '';

  applyFilters();
}

/* ─────────────────────────────────────────
   URL PERSISTENCE
───────────────────────────────────────── */

/**
 * Write current filterState to URL query params (no page reload).
 * Pagination is excluded to keep URLs clean and shareable.
 * @private
 */
function _persistToUrl() {
  const arrayKeys = ['make', 'model', 'year', 'features'];
  const skipKeys  = ['current_page', 'per_page'];
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
  const arrayKeys = ['make', 'model', 'features'];  // strings
  const intArrayKeys = ['year'];                      // integers

  Object.keys(filterState).forEach(key => {
    const val = getUrlParam(key);
    if (val === null) return;

    if (arrayKeys.includes(key)) {
      filterState[key] = val ? val.split(',') : [];
    } else if (intArrayKeys.includes(key)) {
      filterState[key] = val
        ? val.split(',').map(Number).filter(n => !isNaN(n))
        : [];
    } else if (key === 'current_page' || key === 'per_page') {
      const n = Number(val);
      if (!isNaN(n) && n > 0) filterState[key] = n;
    } else {
      filterState[key] = val;
    }
  });
}

/* ─────────────────────────────────────────
   STATIC FILTER BINDING
───────────────────────────────────────── */

/**
 * Bind all static filter controls to filterState.
 * Supports:
 *   [wized="filter_search_input"]                          — debounced text search
 *   [data-kd="filter-select"][data-filter-key="<field>"]  — single-value selects
 *   [data-kd="filter-input"][data-filter-key="<field>"]   — range / text inputs
 *   [data-kd="sort-select"]                               — combined "field:direction"
 *   [data-kd="per-page-select"]                           — per_page
 *   [data-kd="filter-apply"]                              — manual apply button
 *   [data-kd="filter-reset"]                              — reset all button
 *   [data-kd="filter-clear-all"]                          — clear-all chips button
 * @private
 */
function _bindStaticFilters() {
  // ── Search input (debounced) ─────────────────────────────────────────────────
  const searchInput = document.querySelector('[wized="filter_search_input"]');
  if (searchInput) {
    const debouncedSearch = debounce(() => {
      filterState.search = searchInput.value.trim();
      filterState.current_page = 1;
      applyFilters();
    }, 400);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // ── Generic selects ──────────────────────────────────────────────────────────
  document.querySelectorAll('[data-kd="filter-select"]').forEach(select => {
    const key = select.getAttribute('data-filter-key');
    if (!key) return;
    // Restore DOM value from state
    if (!Array.isArray(filterState[key]) && filterState[key]) {
      select.value = filterState[key];
    }
    select.addEventListener('change', () => {
      filterState[key] = select.value;
      filterState.current_page = 1;
      applyFilters();
    });
  });

  // ── Generic range / text inputs ──────────────────────────────────────────────
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

  // ── Sort select — value format "field:direction" e.g. "price:asc" ───────────
  const sortSelect = document.querySelector('[data-kd="sort-select"]');
  if (sortSelect) {
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

  // ── Per-page select ──────────────────────────────────────────────────────────
  const perPageSelect = document.querySelector('[data-kd="per-page-select"]');
  if (perPageSelect) {
    perPageSelect.value = String(filterState.per_page);
    perPageSelect.addEventListener('change', () => {
      filterState.per_page     = Number(perPageSelect.value) || 20;
      filterState.current_page = 1;
      applyFilters();
    });
  }

  // ── Manual apply button ──────────────────────────────────────────────────────
  const applyBtn = document.querySelector('[data-kd="filter-apply"]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      filterState.current_page = 1;
      applyFilters();
    });
  }

  // ── Reset button ─────────────────────────────────────────────────────────────
  const resetBtn = document.querySelector('[data-kd="filter-reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  // ── Clear-all chips button ───────────────────────────────────────────────────
  const clearAll = document.querySelector('[data-kd="filter-clear-all"]');
  if (clearAll) {
    clearAll.style.display = 'none';
    clearAll.addEventListener('click', resetFilters);
  }
}

/**
 * Populate the search input from filterState on init (after URL restore).
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

window.initFilters  = initFilters;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
