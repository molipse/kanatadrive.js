/**
 * api.js — KanataDrive
 * Base HTTP client for Xano REST API.
 * Depends on: utils.js (getCookie must be loaded first)
 */

const API_BASE = 'https://x8ki-letl-twmt.n7.xano.io/api:K1kUAXTG';

/* ─────────────────────────────────────────
   TOKEN
───────────────────────────────────────── */

/**
 * Read the auth token from the authToken cookie.
 * @returns {string|null}
 */
function getToken() {
  return getCookie('authToken');
}

/* ─────────────────────────────────────────
   INTERNALS
───────────────────────────────────────── */

/**
 * Build request headers.
 * @param {boolean} auth — include Bearer token
 * @returns {Object}
 */
function _buildHeaders(auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Parse response and throw user-friendly errors on non-2xx.
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function _handleResponse(response) {
  // 204 No Content — return null
  if (response.status === 204) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Unexpected server response. Please try again.');
  }

  if (!response.ok) {
    // Xano error shape: { message: "..." } or { error: "..." }
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

/* ─────────────────────────────────────────
   PUBLIC API METHODS
───────────────────────────────────────── */

/**
 * GET request — public or authenticated.
 * @param {string} endpoint — e.g. '/cars'
 * @param {Object} [params={}] — query string params (nulls/undefined/'' are skipped)
 * @param {boolean} [auth=false] — send Bearer token
 * @returns {Promise<any>}
 */
async function apiGet(endpoint, params = {}, auth = false) {
  const url = new URL(API_BASE + endpoint);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: _buildHeaders(auth),
  });

  return _handleResponse(response);
}

/**
 * POST request.
 * @param {string} endpoint
 * @param {Object} [body={}]
 * @param {boolean} [auth=false] — most POST endpoints are public (register, login, inquiry)
 * @returns {Promise<any>}
 */
async function apiPost(endpoint, body = {}, auth = false) {
  const response = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: _buildHeaders(auth),
    body: JSON.stringify(body),
  });

  return _handleResponse(response);
}

/**
 * PUT request — authenticated by default.
 * @param {string} endpoint
 * @param {Object} [body={}]
 * @param {boolean} [auth=true]
 * @returns {Promise<any>}
 */
async function apiPut(endpoint, body = {}, auth = true) {
  const response = await fetch(API_BASE + endpoint, {
    method: 'PUT',
    headers: _buildHeaders(auth),
    body: JSON.stringify(body),
  });

  return _handleResponse(response);
}

/**
 * DELETE request — authenticated by default.
 * @param {string} endpoint
 * @param {boolean} [auth=true]
 * @returns {Promise<any>}
 */
async function apiDelete(endpoint, auth = true) {
  const response = await fetch(API_BASE + endpoint, {
    method: 'DELETE',
    headers: _buildHeaders(auth),
  });

  return _handleResponse(response);
}

/**
 * Multipart POST — for file/image uploads.
 * Does NOT set Content-Type (browser sets boundary automatically).
 * @param {string} endpoint
 * @param {FormData} formData
 * @param {boolean} [auth=true]
 * @returns {Promise<any>}
 */
async function apiPostForm(endpoint, formData, auth = true) {
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers,
    body: formData,
  });

  return _handleResponse(response);
}
