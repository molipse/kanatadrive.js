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
 * On a fresh page load (no URL params) shows all cars immediately.
 * On a shared URL (has filter params) restores state and applies filters.
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

  // If the URL already has filter params (shared link) — apply them.
  // Otherwise just load all cars with no filters.
  if (_hasActiveFilters()) {
    applyFilters();
  } else {
    loadAllCars();
  }
}

/* ─────────────────────────────────────────
   LOAD ALL CARS (unfiltered)
───────────────────────────────────────── */

/**
 * Fetch and render all cars with no filters applied.
 * Used on initial page load and after resetFilters().
 */
async function loadAllCars() {
  const container = document.querySelector('[data-kd="cars-list"]') ||
                    document.querySelector('[wized="cars-list"]');
  if (!container) return;

  showLoading(container);
  try {
    const cars = await getCars({});
    hideLoading(container);
    renderCarCards(cars, container);
  } catch (err) {
    hideLoading(container);
    showError(container, err.message || 'Failed to load cars. Please try again.');
  }
}

/* ─────────────────────────────────────────
   RENDER FILTER INPUTS
───────────────────────────────────────── */

/**
 * Render make checkboxes into [data-kd="make-filter-list"].
 * Checking/unchecking immediately triggers applyFilters().
 * @param {Array<{id: number, name: string}>} makes
 */
function renderMakeCheckboxes(makes) {
  const container = document.querySelector('[data-kd="make-filter-list"]');
  if (!container) return;

  container.innerHTML = '';
  makes.forEach(makeObj => {
    // API returns { id, make: "Ford" } — the name field is "make", not "name"
    const makeName = makeObj.make || makeObj.name || '';
    if (!makeName) return;

    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-family:Satoshi,sans-serif;font-size:14px;padding:4px 0;';
    label.innerHTML = `
      <input type="checkbox" data-kd="make-checkbox" value="${makeName}"
        ${filterState.make.includes(makeName) ? 'checked' : ''}
        style="accent-color:#5720CD;width:16px;height:16px;">
      ${makeName}
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!filterState.make.includes(makeName)) filterState.make.push(makeName);
      } else {
        filterState.make = filterState.make.filter(m => m !== makeName);
      }
      filterState.current_page = 1;
      applyFilters();
    });
    container.appendChild(label);
  });
}

/**
 * Render drivetrain checkboxes into [data-kd="drivetrain-filter-list"],
 * falling back to a <select> at [data-kd="drivetrain-filter"].
 * Checking/selecting immediately triggers applyFilters().
 * @param {Array<{id: number, name: string}>} drivetrains
 */
function renderDrivetrainOptions(drivetrains) {
  // Preferred: checkbox list (matches spec)
  const list = document.querySelector('[data-kd="drivetrain-filter-list"]');
  if (list) {
    list.innerHTML = '';
    drivetrains.forEach(dt => {
      // API returns { id, drivetrain_type: "AWD" } — name field is "drivetrain_type"
      const dtName = dt.drivetrain_type || dt.name || '';
      if (!dtName) return;

      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-family:Satoshi,sans-serif;font-size:14px;padding:4px 0;';
      label.innerHTML = `
        <input type="checkbox" data-kd="drivetrain-checkbox" value="${dt.id}"
          ${filterState.drivetrain === String(dt.id) ? 'checked' : ''}
          style="accent-color:#5720CD;width:16px;height:16px;">
        ${dtName}
      `;
      label.querySelector('input').addEventListener('change', (e) => {
        // Drivetrain is single-value — uncheck others when one is picked
        list.querySelectorAll('[data-kd="drivetrain-checkbox"]').forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
        filterState.drivetrain = e.target.checked ? String(dt.id) : '';
        filterState.current_page = 1;
        applyFilters();
      });
      list.appendChild(label);
    });
    return;
  }

  // Fallback: <select> element
  const select = document.querySelector('[data-kd="drivetrain-filter"]');
  if (!select) return;

  select.innerHTML = '<option value="">Any Drivetrain</option>';
  drivetrains.forEach(dt => {
    const option = document.createElement('option');
    option.value = dt.id;
    option.textContent = dt.drivetrain_type || dt.name || '';
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
 * Checking/unchecking immediately triggers applyFilters().
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
 * Collect current filterState → fetch cars → render cards.
 * Persists state to URL and updates chips + count badge.
 * Triggered by: checkbox change, Apply button, chip removal, Reset.
 * NOT triggered by: typing in price/mileage inputs (use Apply button).
 */
async function applyFilters() {
  // Collect price/mileage values from DOM inputs at apply-time
  // so the user can type freely without triggering a fetch on every keystroke.
  _collectRangeInputs();

  _persistToUrl();
  renderFilterChips();
  _updateFilterCount();

  const container = document.querySelector('[data-kd="cars-list"]') ||
                    document.querySelector('[wized="cars-list"]');
  if (!container) return;

  // Build API params — only keys with actual values.
  // Arrays are comma-joined: apiGet uses URLSearchParams.set() which can't
  // handle arrays natively; Xano receives ?make=Toyota,Honda and splits on comma.
  const params = {};

  if (filterState.search) params.search = filterState.search;

  // Pass arrays as-is — getCars expands them to make[0]=Ford&make[1]=Tesla bracket notation
  if (filterState.make.length)     params.make     = filterState.make;
  if (filterState.model.length)    params.model    = filterState.model;
  if (filterState.year.length)     params.year     = filterState.year;
  if (filterState.features.length) params.features = filterState.features;

  if (filterState.price_min)   params.price_min   = Number(filterState.price_min);
  if (filterState.price_max)   params.price_max   = Number(filterState.price_max);
  if (filterState.mileage_min) params.mileage_min = Number(filterState.mileage_min);
  if (filterState.mileage_max) params.mileage_max = Number(filterState.mileage_max);

  if (filterState.body_style)   params.body_style   = filterState.body_style;
  if (filterState.fuel_type)    params.fuel_type    = filterState.fuel_type;
  if (filterState.transmission) params.transmission = filterState.transmission;
  if (filterState.condition)    params.condition    = filterState.condition;
  if (filterState.drivetrain)   params.drivetrain   = filterState.drivetrain;

  if (filterState.sort_field)     params.sort_field     = filterState.sort_field;
  if (filterState.sort_direction) params.sort_direction = filterState.sort_direction;

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

/**
 * Read price and mileage values from DOM inputs into filterState.
 * Called once inside applyFilters() — inputs are NOT bound to live change events.
 * @private
 */
function _collectRangeInputs() {
  const fields = ['price_min', 'price_max', 'mileage_min', 'mileage_max'];
  fields.forEach(key => {
    // Support both data-kd="price-min" style and data-filter-key="price_min" style
    const dashKey = key.replace('_', '-');
    const el = document.querySelector(`[data-kd="${dashKey}"]`) ||
               document.querySelector(`[data-kd="filter-input"][data-filter-key="${key}"]`);
    if (el) filterState[key] = el.value.trim();
  });

  // Search input
  const searchEl = document.querySelector('[data-kd="search-input"]') ||
                   document.querySelector('[wized="filter_search_input"]');
  if (searchEl) filterState.search = searchEl.value.trim();
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

  if (filterState.make.length)     count++;
  if (filterState.model.length)    count++;
  if (filterState.year.length)     count++;
  if (filterState.features.length) count++;

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
 * Each chip has an ✕ button that clears that filter and re-applies.
 */
function renderFilterChips() {
  const container = document.querySelector('[data-kd="filter-chips"]');
  if (!container) return;

  container.innerHTML = '';
  let hasChips = false;

  // ── Array filters ────────────────────────────────────────────────────────────
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

  // ── Scalar filters ────────────────────────────────────────────────────────────
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
      if (key === 'sort_field') {
        filterState.sort_direction = '';
        const sortSelect = document.querySelector('[data-kd="sort-select"]');
        if (sortSelect) sortSelect.value = '';
      }
      _syncInputForKey(key);
      filterState.current_page = 1;
      applyFilters();
    }));
  });

  // ── Features ──────────────────────────────────────────────────────────────────
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

  // ── Clear-all visibility ──────────────────────────────────────────────────────
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
 * Uncheck all DOM checkboxes for a given array filter key.
 * @param {string} key — 'make' | 'model' | 'year'
 * @private
 */
function _syncCheckboxes(key) {
  const map = {
    make:  '[data-kd="make-checkbox"]',
    model: '[data-kd="model-checkbox"]',
    year:  '[data-kd="year-checkbox"]',
  };
  if (map[key]) {
    document.querySelectorAll(map[key]).forEach(cb => { cb.checked = false; });
  }
}

/**
 * Reset the DOM input or select for a scalar filter key.
 * Supports data-kd="price-min" style, data-filter-key style, and special inputs.
 * @param {string} key
 * @private
 */
function _syncInputForKey(key) {
  // data-kd="price-min" / "mileage-max" etc.
  const dashKey = key.replace('_', '-');
  const direct = document.querySelector(`[data-kd="${dashKey}"]`);
  if (direct && (direct.tagName === 'INPUT' || direct.tagName === 'SELECT')) {
    direct.value = '';
    return;
  }

  // data-kd="filter-select" with data-filter-key
  const select = document.querySelector(`[data-kd="filter-select"][data-filter-key="${key}"]`);
  if (select) { select.value = ''; return; }

  // data-kd="filter-input" with data-filter-key
  const input = document.querySelector(`[data-kd="filter-input"][data-filter-key="${key}"]`);
  if (input) { input.value = ''; return; }

  // Search (both naming conventions)
  if (key === 'search') {
    [document.querySelector('[data-kd="search-input"]'),
     document.querySelector('[wized="filter_search_input"]')]
      .forEach(el => { if (el) el.value = ''; });
  }
}

/* ─────────────────────────────────────────
   RESET
───────────────────────────────────────── */

/**
 * Clear all active filters, reset DOM, clear URL params, then load all cars.
 */
function resetFilters() {
  // State — arrays
  filterState.make     = [];
  filterState.model    = [];
  filterState.year     = [];
  filterState.features = [];

  // State — scalars
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

  // State — pagination
  filterState.current_page = 1;
  filterState.per_page     = 20;

  // DOM — checkboxes
  document.querySelectorAll(
    '[data-kd="make-checkbox"], [data-kd="feature-checkbox"], [data-kd="drivetrain-checkbox"]'
  ).forEach(cb => { cb.checked = false; });

  // DOM — range/text inputs (data-kd="price-min" etc.)
  ['price-min', 'price-max', 'mileage-min', 'mileage-max'].forEach(attr => {
    const el = document.querySelector(`[data-kd="${attr}"]`);
    if (el) el.value = '';
  });

  // DOM — generic selects and inputs
  document.querySelectorAll('[data-kd="filter-select"]').forEach(sel => { sel.value = ''; });
  document.querySelectorAll('[data-kd="filter-input"]').forEach(inp => { inp.value = ''; });

  // DOM — dedicated controls
  [document.querySelector('[data-kd="search-input"]'),
   document.querySelector('[wized="filter_search_input"]')]
    .forEach(el => { if (el) el.value = ''; });

  const sortSelect = document.querySelector('[data-kd="sort-select"]');
  if (sortSelect) sortSelect.value = '';

  const perPageSelect = document.querySelector('[data-kd="per-page-select"]');
  if (perPageSelect) perPageSelect.value = '20';

  const drivetrainSelect = document.querySelector('[data-kd="drivetrain-filter"]');
  if (drivetrainSelect) drivetrainSelect.value = '';

  // Clear chips and badge immediately (don't wait for loadAllCars)
  const chips = document.querySelector('[data-kd="filter-chips"]');
  if (chips) chips.innerHTML = '';

  const clearAll = document.querySelector('[data-kd="filter-clear-all"]');
  if (clearAll) clearAll.style.display = 'none';

  const badge = document.querySelector('[data-kd="filter-count"]');
  if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }

  // Clear URL params
  window.history.pushState({}, '', window.location.pathname);

  // Reload all cars unfiltered
  loadAllCars();
}

/* ─────────────────────────────────────────
   URL PERSISTENCE
───────────────────────────────────────── */

/**
 * Returns true if the current URL has any filter query params.
 * Used on init to decide between loadAllCars() and applyFilters().
 * @returns {boolean}
 * @private
 */
function _hasActiveFilters() {
  return new URLSearchParams(window.location.search).toString().length > 0;
}

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
  const arrayKeys    = ['make', 'model', 'features']; // string arrays
  const intArrayKeys = ['year'];                        // integer arrays

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
 * Bind all static filter controls.
 *
 * Trigger rules:
 *   Checkboxes (make, drivetrain, features) → applyFilters() immediately on change
 *   Price / mileage inputs                  → NO auto-apply; wait for Apply button
 *   Search input                            → applyFilters() on Enter OR after 500ms debounce
 *   Sort select                             → applyFilters() immediately on change
 *   Per-page select                         → applyFilters() immediately on change
 *   [data-kd="filter-apply"]               → applyFilters() (collects range inputs first)
 *   [data-kd="filter-reset"]               → resetFilters() then loadAllCars()
 *   [data-kd="filter-clear-all"]           → resetFilters() then loadAllCars()
 *
 * @private
 */
function _bindStaticFilters() {
  // ── Search input — apply on Enter or after 500ms debounce ───────────────────
  const searchEl = document.querySelector('[data-kd="search-input"]') ||
                   document.querySelector('[wized="filter_search_input"]');
  if (searchEl) {
    const debouncedSearch = debounce(() => {
      filterState.search = searchEl.value.trim();
      filterState.current_page = 1;
      applyFilters();
    }, 500);
    searchEl.addEventListener('input', debouncedSearch);
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        filterState.search = searchEl.value.trim();
        filterState.current_page = 1;
        applyFilters();
      }
    });
  }

  // ── Price / mileage inputs — bound to filterState but NO auto-apply ─────────
  // Values are read from DOM by _collectRangeInputs() inside applyFilters().
  // Restore DOM values from URL-restored state on init.
  ['price_min', 'price_max', 'mileage_min', 'mileage_max'].forEach(key => {
    const dashKey = key.replace('_', '-');
    const el = document.querySelector(`[data-kd="${dashKey}"]`) ||
               document.querySelector(`[data-kd="filter-input"][data-filter-key="${key}"]`);
    if (el && filterState[key]) el.value = filterState[key];
    // Intentionally no 'change' / 'input' event listener here
  });

  // ── Generic selects (non-range) — apply immediately on change ───────────────
  document.querySelectorAll('[data-kd="filter-select"]').forEach(select => {
    const key = select.getAttribute('data-filter-key');
    if (!key) return;
    // Skip range fields — those are handled by Apply button
    if (['price_min', 'price_max', 'mileage_min', 'mileage_max'].includes(key)) return;
    if (!Array.isArray(filterState[key]) && filterState[key]) {
      select.value = filterState[key];
    }
    select.addEventListener('change', () => {
      filterState[key] = select.value;
      filterState.current_page = 1;
      applyFilters();
    });
  });

  // ── Sort select — apply immediately on change ────────────────────────────────
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

  // ── Per-page select — apply immediately on change ────────────────────────────
  const perPageSelect = document.querySelector('[data-kd="per-page-select"]');
  if (perPageSelect) {
    perPageSelect.value = String(filterState.per_page);
    perPageSelect.addEventListener('change', () => {
      filterState.per_page     = Number(perPageSelect.value) || 20;
      filterState.current_page = 1;
      applyFilters();
    });
  }

  // ── Apply button — collects range inputs then applies ────────────────────────
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

  // ── Clear-all chips button ────────────────────────────────────────────────────
  const clearAll = document.querySelector('[data-kd="filter-clear-all"]');
  if (clearAll) {
    clearAll.style.display = 'none';
    clearAll.addEventListener('click', resetFilters);
  }
}

/**
 * Populate filter inputs from filterState after URL restore (init only).
 * @private
 */
function _updateSearchInput() {
  const searchEl = document.querySelector('[data-kd="search-input"]') ||
                   document.querySelector('[wized="filter_search_input"]');
  if (searchEl && filterState.search) searchEl.value = filterState.search;
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

function initFiltersPage() {
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
window.loadAllCars  = loadAllCars;
