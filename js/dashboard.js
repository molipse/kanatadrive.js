/**
 * dashboard.js — KanataDrive
 * Dealer dashboard: listings, add/edit car forms, requests, account settings.
 * Depends on: utils.js, api.js, auth.js, cars.js, requests.js
 */

/* ─────────────────────────────────────────
   MY LISTINGS
───────────────────────────────────────── */

/**
 * Load and render the authenticated dealer's car listings.
 * Target container: [data-kd="my-listings-container"]
 */
async function initMyListings() {
  const container = document.querySelector('[data-kd="my-listings-container"]');
  if (!container) return;

  showLoading(container);
  try {
    const cars = await getDealerCars();
    hideLoading(container);
    _renderListingsTable(cars, container);
  } catch (err) {
    hideLoading(container);
    showError(container, err.message || 'Failed to load your listings.');
  }
}

/**
 * Render dealer's cars as a table/list with edit + delete actions.
 * @param {Array} cars
 * @param {HTMLElement} container
 * @private
 */
function _renderListingsTable(cars, container) {
  container.innerHTML = '';

  if (!cars || cars.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px;color:#888;font-family:Satoshi,sans-serif;">
        You have no listings yet.
        <br><br>
        <a href="/dashboard/add-car" style="color:#5720CD;font-weight:600;">+ Add your first car</a>
      </div>
    `;
    return;
  }

  cars.forEach(car => {
    const row = document.createElement('div');
    row.setAttribute('data-kd', 'listing-row');
    row.setAttribute('data-car-id', car.id);
    row.style.cssText = `
      display:flex;align-items:center;gap:16px;padding:16px;
      border-bottom:1px solid #f0f0f0;font-family:Satoshi,sans-serif;
    `;

    const photoUrl = getImageUrl(car.main_photo, 'https://placehold.co/80x60?text=—');
    row.innerHTML = `
      <img src="${photoUrl}" alt="${car.make} ${car.model}"
        style="width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:#121726;">${car.year} ${car.make} ${car.model}</div>
        <div style="font-size:13px;color:#888;">${formatPrice(car.price)} · ${formatMileage(car.mileage)}</div>
        <div style="font-size:12px;margin-top:2px;">
          <span data-kd="listing-status-badge" style="
            background:${car.status === 'active' ? '#D1FAE5' : car.status === 'sold' ? '#FEE2E2' : '#F3F4F6'};
            color:${car.status === 'active' ? '#065F46' : car.status === 'sold' ? '#991B1B' : '#374151'};
            padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;
          ">${car.status || 'active'}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <a href="/dashboard/edit-car?id=${car.id}"
          style="padding:6px 14px;border-radius:6px;border:1px solid #5720CD;color:#5720CD;
          font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;">
          Edit
        </a>
        <button data-kd="delete-car-btn" data-car-id="${car.id}"
          style="padding:6px 14px;border-radius:6px;border:1px solid #e0e0e0;background:#fff;
          color:#888;font-size:13px;cursor:pointer;white-space:nowrap;">
          Delete
        </button>
      </div>
    `;

    row.querySelector('[data-kd="delete-car-btn"]').addEventListener('click', () => {
      _confirmDeleteCar(car.id, row);
    });

    container.appendChild(row);
  });
}

/**
 * Confirm and execute car deletion.
 * @param {string} carId
 * @param {HTMLElement} rowEl — row to remove from DOM on success
 * @private
 */
async function _confirmDeleteCar(carId, rowEl) {
  if (!confirm('Are you sure you want to delete this listing? This cannot be undone.')) return;

  try {
    await deleteCar(carId);
    rowEl.remove();
  } catch (err) {
    alert(err.message || 'Failed to delete listing.');
  }
}

/* ─────────────────────────────────────────
   ADD CAR
───────────────────────────────────────── */

/**
 * Initialize the Add Car form.
 * Form selector: [data-kd="add-car-form"]
 */
async function initAddCar() {
  const form = document.querySelector('[data-kd="add-car-form"]');
  if (!form) return;

  await _populateCarFormSelects(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[data-kd="car-form-btn"]');

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const data = _collectCarFormData(form);
      await createCar(data);
      showSuccess(form, 'Listing created!');
      setTimeout(() => { window.location.href = '/dashboard/my-listings'; }, 1500);
    } catch (err) {
      showError(form, err.message || 'Failed to create listing.');
      btn.disabled = false;
      btn.textContent = 'Add Listing';
    }
  });
}

/* ─────────────────────────────────────────
   EDIT CAR
───────────────────────────────────────── */

/**
 * Initialize the Edit Car form.
 * Reads ?id= from URL, pre-fills form with existing data.
 */
async function initEditCar() {
  const id = getUrlParam('id');
  const form = document.querySelector('[data-kd="edit-car-form"]');
  if (!form || !id) return;

  showLoading(form);
  try {
    const [car] = await Promise.all([
      getSingleCar(id),
      _populateCarFormSelects(form),
    ]);
    hideLoading(form);
    _fillCarForm(form, car);
  } catch (err) {
    hideLoading(form);
    showError(form, err.message || 'Failed to load car data.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[data-kd="car-form-btn"]');

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const data = _collectCarFormData(form);
      await updateCar(id, data);
      showSuccess(form, 'Listing updated!');
      setTimeout(() => { window.location.href = '/dashboard/my-listings'; }, 1500);
    } catch (err) {
      showError(form, err.message || 'Failed to update listing.');
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });
}

/**
 * Pre-fill form fields from a car object.
 * @param {HTMLFormElement} form
 * @param {Object} car
 * @private
 */
function _fillCarForm(form, car) {
  const fields = [
    'make','model','year','vin','mileage','color','intcolor',
    'transmission','engineLi','body_style','fuel_type','condition',
    'price','price_month','carLocation','seats','description','status',
  ];
  fields.forEach(key => {
    const el = form.querySelector(`[data-kd="car-field-${key}"]`);
    if (el && car[key] != null) el.value = car[key];
  });

  // Drivetrain
  const dtSelect = form.querySelector('[data-kd="car-field-drivetrain"]');
  if (dtSelect && car.drivetrain) dtSelect.value = car.drivetrain;
}

/**
 * Read all car form fields into a plain object.
 * @param {HTMLFormElement} form
 * @returns {Object}
 * @private
 */
function _collectCarFormData(form) {
  const data = {};
  const numberFields = ['year','mileage','price','price_month','seats','drivetrain'];

  form.querySelectorAll('[data-kd^="car-field-"]').forEach(el => {
    const key = el.getAttribute('data-kd').replace('car-field-', '');
    const val = el.value.trim();
    if (val === '') return;
    data[key] = numberFields.includes(key) ? Number(val) : val;
  });

  return data;
}

/**
 * Populate drivetrain select in a car form.
 * @param {HTMLFormElement} form
 * @private
 */
async function _populateCarFormSelects(form) {
  try {
    const drivetrains = await apiGet('/drivetrain');
    const select = form.querySelector('[data-kd="car-field-drivetrain"]');
    if (select) {
      select.innerHTML = '<option value="">Select drivetrain</option>';
      drivetrains.forEach(dt => {
        const opt = document.createElement('option');
        opt.value = dt.id;
        opt.textContent = dt.name;
        select.appendChild(opt);
      });
    }
  } catch {
    // non-critical
  }
}

/* ─────────────────────────────────────────
   REQUESTS
───────────────────────────────────────── */

/**
 * Load and render dealer's buyer inquiries.
 * Target: [data-kd="requests-container"]
 */
async function initRequests() {
  const container = document.querySelector('[data-kd="requests-container"]');
  if (!container) return;

  showLoading(container);
  try {
    const requests = await getDealerRequests();
    hideLoading(container);
    renderRequests(requests, container);
  } catch (err) {
    hideLoading(container);
    showError(container, err.message || 'Failed to load inquiries.');
  }
}

/* ─────────────────────────────────────────
   ACCOUNT
───────────────────────────────────────── */

/**
 * Load and populate the dealer account/profile form.
 * Target: [data-kd="account-form"]
 */
async function initAccount() {
  const form = document.querySelector('[data-kd="account-form"]');
  if (!form) return;

  showLoading(form);
  try {
    const user = await apiGet('/auth/me', {}, true);
    hideLoading(form);
    _fillAccountForm(form, user);
  } catch (err) {
    hideLoading(form);
    showError(form, err.message || 'Failed to load account data.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[data-kd="account-save-btn"]');
    const user = await apiGet('/auth/me', {}, true);

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const data = _collectAccountFormData(form);
      await apiPut(`/users/${user.id}`, data, true);
      showSuccess(form, 'Profile updated!');
    } catch (err) {
      showError(form, err.message || 'Failed to update profile.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });
}

/**
 * Pre-fill account form from user object.
 * @param {HTMLFormElement} form
 * @param {Object} user
 * @private
 */
function _fillAccountForm(form, user) {
  const fields = ['dealerName','email','phone','location','dealerAddress','dealerHours'];
  fields.forEach(key => {
    const el = form.querySelector(`[data-kd="account-field-${key}"]`);
    if (el && user[key] != null) el.value = user[key];
  });

  const avatarEl = form.querySelector('[data-kd="account-avatar-preview"]');
  if (avatarEl) avatarEl.src = getImageUrl(user.dealerAvatar);
}

/**
 * Collect account form data.
 * @param {HTMLFormElement} form
 * @returns {Object}
 * @private
 */
function _collectAccountFormData(form) {
  const data = {};
  form.querySelectorAll('[data-kd^="account-field-"]').forEach(el => {
    const key = el.getAttribute('data-kd').replace('account-field-', '');
    const val = el.value.trim();
    if (val !== '') data[key] = val;
  });
  return data;
}
