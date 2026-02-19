/**
 * requests.js — KanataDrive
 * Buyer inquiry form submission + dealer request management.
 * Depends on: utils.js, api.js
 */
if (window.__KD_REQUESTS_LOADED__) { /* already loaded, skip */ return; }
window.__KD_REQUESTS_LOADED__ = true;


/* ─────────────────────────────────────────
   BUYER — SUBMIT INQUIRY
───────────────────────────────────────── */

/**
 * Submit a buyer inquiry for a specific car.
 * @param {string} carId
 * @param {number} dealerId
 * @param {Object} formData — { buyer_name, buyer_email, buyer_phone, message }
 * @returns {Promise<Object>}
 */
async function submitInquiry(carId, dealerId, formData) {
  return apiPost('/requests', {
    car_id: carId,
    dealer_id: dealerId,
    ...formData,
  });
}

/**
 * Initialize the inquiry form on the car detail page.
 * Form selector: [data-kd="inquiry-form"]
 * Car/dealer IDs are expected as data attributes set by cars.js renderCarDetail().
 */
function initInquiryForm() {
  const form = document.querySelector('[data-kd="inquiry-form"]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const carId = form.getAttribute('data-car-id');
    const dealerId = Number(form.getAttribute('data-dealer-id'));
    const btn = form.querySelector('[data-kd="inquiry-btn"]');

    const buyer_name = form.querySelector('[data-kd="inquiry-name"]')?.value.trim();
    const buyer_email = form.querySelector('[data-kd="inquiry-email"]')?.value.trim();
    const buyer_phone = form.querySelector('[data-kd="inquiry-phone"]')?.value.trim();
    const message = form.querySelector('[data-kd="inquiry-message"]')?.value.trim();

    if (!buyer_name || !buyer_email || !message) {
      showError(form, 'Please fill in your name, email, and message.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await submitInquiry(carId, dealerId, { buyer_name, buyer_email, buyer_phone, message });
      showSuccess(form, 'Your inquiry has been sent! The dealer will contact you shortly.');
      form.reset();
    } catch (err) {
      showError(form, err.message || 'Failed to send inquiry. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Inquiry';
    }
  });
}

/* ─────────────────────────────────────────
   DEALER — VIEW REQUESTS
───────────────────────────────────────── */

/**
 * Fetch all requests for the authenticated dealer.
 * @returns {Promise<Array>}
 */
async function getDealerRequests() {
  return apiGet('/requests', {}, true);
}

/**
 * Update the status of a request.
 * @param {number} id — request ID
 * @param {string} status — "new" | "read" | "archived"
 * @returns {Promise<Object>}
 */
async function updateRequestStatus(id, status) {
  return apiPut(`/requests/${id}`, { status }, true);
}

/**
 * Render dealer requests into a container.
 * @param {Array} requests
 * @param {HTMLElement} [container] — defaults to [data-kd="requests-container"]
 */
function renderRequests(requests, container) {
  const el = container || document.querySelector('[data-kd="requests-container"]');
  if (!el) return;

  el.innerHTML = '';

  if (!requests || requests.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:48px;color:#888;font-family:Satoshi,sans-serif;">
        No inquiries yet.
      </div>
    `;
    return;
  }

  requests.forEach(req => {
    el.appendChild(_buildRequestCard(req));
  });
}

/**
 * Build a single request card element.
 * @param {Object} req
 * @returns {HTMLElement}
 * @private
 */
function _buildRequestCard(req) {
  const card = document.createElement('div');
  card.setAttribute('data-kd', 'request-card');
  card.setAttribute('data-request-id', req.id);

  const statusColor = {
    new: { bg: '#DBEAFE', text: '#1E40AF' },
    read: { bg: '#F3F4F6', text: '#374151' },
    archived: { bg: '#F3F4F6', text: '#9CA3AF' },
  }[req.status] || { bg: '#F3F4F6', text: '#374151' };

  card.style.cssText = `
    padding:20px;border-radius:12px;border:1px solid #f0f0f0;
    margin-bottom:12px;font-family:Satoshi,sans-serif;background:#fff;
  `;

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
      <div>
        <div style="font-weight:700;font-size:15px;color:#121726;">${req.buyer_name}</div>
        <div style="font-size:13px;color:#888;margin-top:2px;">
          ${req.buyer_email}${req.buyer_phone ? ' · ' + req.buyer_phone : ''}
        </div>
        <div style="font-size:12px;color:#aaa;margin-top:2px;">${formatDate(req.created_at)}</div>
      </div>
      <span data-kd="request-status-badge" style="
        background:${statusColor.bg};color:${statusColor.text};
        padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;
      ">${req.status}</span>
    </div>
    <p style="font-size:14px;color:#444;margin:0 0 16px;line-height:1.5;">${req.message || ''}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button data-kd="mark-read-btn" data-id="${req.id}"
        style="padding:6px 14px;border-radius:6px;border:1px solid #5720CD;color:#5720CD;
        background:#fff;font-size:13px;cursor:pointer;font-family:Satoshi,sans-serif;">
        Mark as Read
      </button>
      <button data-kd="archive-btn" data-id="${req.id}"
        style="padding:6px 14px;border-radius:6px;border:1px solid #e0e0e0;color:#888;
        background:#fff;font-size:13px;cursor:pointer;font-family:Satoshi,sans-serif;">
        Archive
      </button>
    </div>
  `;

  card.querySelector('[data-kd="mark-read-btn"]').addEventListener('click', async () => {
    await _setRequestStatus(req.id, 'read', card);
  });

  card.querySelector('[data-kd="archive-btn"]').addEventListener('click', async () => {
    await _setRequestStatus(req.id, 'archived', card);
  });

  return card;
}

/**
 * Update a request's status and update the badge in the DOM.
 * @param {number} id
 * @param {string} status
 * @param {HTMLElement} cardEl
 * @private
 */
async function _setRequestStatus(id, status, cardEl) {
  try {
    await updateRequestStatus(id, status);
    const badge = cardEl.querySelector('[data-kd="request-status-badge"]');
    if (badge) badge.textContent = status;
  } catch (err) {
    alert(err.message || 'Failed to update request.');
  }
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Inquiry form — present on car detail pages
  if (document.querySelector('[data-kd="inquiry-form"]')) {
    initInquiryForm();
  }
});
