/**
 * vin.js — KanataDrive
 * VIN decoder via RapidAPI.
 * Depends on: utils.js
 *
 * NOTE: Set your RapidAPI key in Webflow Site Settings → Custom Code
 * as a global variable: window.KD_RAPIDAPI_KEY = 'your-key-here';
 * Do NOT commit the key to this file.
 */

const VIN_API_HOST = 'vindecoder.p.rapidapi.com';
const VIN_API_URL = 'https://vindecoder.p.rapidapi.com/v2/decode_vin';

/* ─────────────────────────────────────────
   DECODE
───────────────────────────────────────── */

/**
 * Decode a VIN number via RapidAPI VIN Decoder.
 * @param {string} vin
 * @returns {Promise<Object>} — normalized vehicle data
 */
async function decodeVin(vin) {
  const apiKey = window.KD_RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RapidAPI key not configured.');

  const url = `${VIN_API_URL}?vin=${encodeURIComponent(vin.trim().toUpperCase())}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': VIN_API_HOST,
      'x-rapidapi-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`VIN lookup failed (${response.status}). Check the VIN and try again.`);
  }

  const data = await response.json();
  return _normalizeVinData(data);
}

/**
 * Normalize raw RapidAPI response into our field names.
 * @param {Object} raw — raw API response
 * @returns {Object}
 * @private
 */
function _normalizeVinData(raw) {
  // RapidAPI VIN Decoder returns data.decode array of { label, value } pairs
  const decode = raw?.decode || raw?.data?.decode || [];

  const get = (label) => {
    const entry = decode.find(d => d.label?.toLowerCase() === label.toLowerCase());
    return entry?.value || '';
  };

  return {
    make: get('Make'),
    model: get('Model'),
    year: get('Model Year'),
    body_style: get('Body Class'),
    fuel_type: _normalizeFuel(get('Fuel Type - Primary')),
    transmission: _normalizeTransmission(get('Transmission Style')),
    engineLi: _normalizeEngine(get('Displacement (L)')),
    seats: get('Number of Seats') || get('Seating Capacity'),
    drivetrain_name: get('Drive Type'),
    doors: get('Number of Doors'),
  };
}

/**
 * Normalize fuel type string to our enum values.
 * @param {string} raw
 * @returns {string}
 * @private
 */
function _normalizeFuel(raw) {
  if (!raw) return '';
  const r = raw.toLowerCase();
  if (r.includes('electric') && r.includes('gas')) return 'Hybrid';
  if (r.includes('electric')) return 'Electric';
  if (r.includes('diesel')) return 'Diesel';
  if (r.includes('gasoline') || r.includes('gas') || r.includes('petrol')) return 'Gasoline';
  return raw;
}

/**
 * Normalize transmission string to "Automatic" | "Manual".
 * @param {string} raw
 * @returns {string}
 * @private
 */
function _normalizeTransmission(raw) {
  if (!raw) return '';
  return raw.toLowerCase().includes('manual') ? 'Manual' : 'Automatic';
}

/**
 * Round engine displacement to one decimal.
 * @param {string} raw — e.g. "3.456"
 * @returns {string} — e.g. "3.5"
 * @private
 */
function _normalizeEngine(raw) {
  if (!raw) return '';
  const num = parseFloat(raw);
  return isNaN(num) ? raw : num.toFixed(1);
}

/* ─────────────────────────────────────────
   AUTO-FILL
───────────────────────────────────────── */

/**
 * Fill car form fields from decoded VIN data.
 * Targets [data-kd="car-field-{key}"] inside the given form.
 * @param {Object} vinData — result of decodeVin()
 * @param {HTMLFormElement} [form] — defaults to [data-kd="add-car-form"] or [data-kd="edit-car-form"]
 */
function autoFillFromVin(vinData, form) {
  const f = form ||
    document.querySelector('[data-kd="add-car-form"]') ||
    document.querySelector('[data-kd="edit-car-form"]');
  if (!f) return;

  const fieldMap = {
    make: 'make',
    model: 'model',
    year: 'year',
    body_style: 'body_style',
    fuel_type: 'fuel_type',
    transmission: 'transmission',
    engineLi: 'engineLi',
    seats: 'seats',
  };

  Object.entries(fieldMap).forEach(([dataKey, fieldKey]) => {
    const val = vinData[dataKey];
    if (!val) return;
    const el = f.querySelector(`[data-kd="car-field-${fieldKey}"]`);
    if (el) el.value = val;
  });
}

/* ─────────────────────────────────────────
   PAGE INIT
───────────────────────────────────────── */

/**
 * Initialize the VIN decoder UI.
 * Expects:
 *   - [data-kd="vin-input"] — text input for VIN
 *   - [data-kd="vin-decode-btn"] — trigger button
 *   - [data-kd="vin-status"] — feedback area
 */
function initVinDecoder() {
  const input = document.querySelector('[data-kd="vin-input"]');
  const btn = document.querySelector('[data-kd="vin-decode-btn"]');
  const statusEl = document.querySelector('[data-kd="vin-status"]');

  if (!input || !btn) return;

  // Auto-fill the hidden VIN form field too
  input.addEventListener('input', () => {
    const vinField = document.querySelector('[data-kd="car-field-vin"]');
    if (vinField) vinField.value = input.value.trim().toUpperCase();
  });

  btn.addEventListener('click', async () => {
    const vin = input.value.trim().toUpperCase();

    if (vin.length !== 17) {
      showError(statusEl, 'A VIN must be exactly 17 characters.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Decoding…';
    if (statusEl) statusEl.innerHTML = '';

    try {
      const vinData = await decodeVin(vin);
      autoFillFromVin(vinData);
      showSuccess(statusEl, 'VIN decoded — fields have been filled in. Please review before saving.');
    } catch (err) {
      showError(statusEl, err.message || 'VIN decode failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Decode VIN';
    }
  });
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-kd="vin-decode-btn"]')) {
    initVinDecoder();
  }
});
