/**
 * auth.js — KanataDrive
 * All authentication flows: login, register, verify email, password reset, logout, auth guard.
 * Depends on: utils.js, api.js
 */


/**
 * Log in a dealer.
 * On success: stores token in cookie, redirects to /dashboard/my-listings.
 * @param {string} email
 * @param {string} password
 */
async function login(email, password) {
  const data = await apiPost('/auth/login', { email, password });
  setCookie('authToken', data.authToken);
  window.location.href = '/dashboard/my-listings';
}

/**
 * Register a new dealer account.
 * On success: redirects to /auth/verify-email.
 * @param {string} dealerName
 * @param {string} email
 * @param {string} password
 * @param {string} phone
 */
async function register(dealerName, email, password, phone) {
  await apiPost('/auth/register', { dealerName, email, password, phone });
  window.location.href = '/auth/verify-email';
}

/**
 * Verify email with the token from the magic link.
 * @param {string} token
 */
async function verifyEmail(token) {
  await apiPost('/auth/verify-email', { token });
}

/**
 * Request a password reset email.
 * @param {string} email
 */
async function requestPasswordReset(email) {
  await apiPost('/auth/reset-password-request', { email });
}

/**
 * Complete password reset with token and new password.
 * @param {string} token
 * @param {string} newPassword
 */
async function resetPassword(token, newPassword) {
  await apiPost('/auth/reset-password', { token, password: newPassword });
}

/**
 * Log out: delete auth cookie and redirect to home.
 */
function logout() {
  deleteCookie('authToken');
  window.location.href = '/';
}

/**
 * Auth guard for dashboard pages.
 * Calls GET /auth/me with the stored token.
 * Returns the user object on success, redirects to /login on failure.
 * Call this on DOMContentLoaded on every dashboard page.
 * @returns {Promise<Object|null>}
 */
async function checkAuth() {
  const token = getCookie('authToken');
  if (!token) {
    window.location.href = '/login';
    return null;
  }

  try {
    const user = await apiGet('/auth/me', {}, true);
    return user;
  } catch {
    deleteCookie('authToken');
    window.location.href = '/login';
    return null;
  }
}

/* ─────────────────────────────────────────
   PAGE INIT HELPERS
───────────────────────────────────────── */

/**
 * Bind the login form ([data-kd="login-form"]) to the login() function.
 */
function initLoginForm() {
  const form = document.querySelector('[data-kd="login-form"]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('[data-kd="login-email"]').value.trim();
    const password = form.querySelector('[data-kd="login-password"]').value;
    const btn = form.querySelector('[data-kd="login-btn"]');

    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      await login(email, password);
    } catch (err) {
      showError(form, err.message || 'Login failed. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

/**
 * Bind the register form ([data-kd="register-form"]) to the register() function.
 */
function initRegisterForm() {
  const form = document.querySelector('[data-kd="register-form"]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dealerName = form.querySelector('[data-kd="register-name"]').value.trim();
    const email = form.querySelector('[data-kd="register-email"]').value.trim();
    const password = form.querySelector('[data-kd="register-password"]').value;
    const phone = form.querySelector('[data-kd="register-phone"]').value.trim();
    const btn = form.querySelector('[data-kd="register-btn"]');

    if (!dealerName || !email || !password || !phone) {
      showError(form, 'Please fill in all fields.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      await register(dealerName, email, password, phone);
    } catch (err) {
      showError(form, err.message || 'Registration failed. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

/**
 * Bind all [data-kd="logout-btn"] elements to logout().
 */
function initLogoutButtons() {
  document.querySelectorAll('[data-kd="logout-btn"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  });
}

/**
 * Handle email verification page.
 * Reads ?token= from URL and calls verifyEmail().
 */
async function initVerifyEmailPage() {
  const token = getUrlParam('token');
  const statusEl = document.querySelector('[data-kd="verify-status"]');

  if (!token) {
    showError(statusEl, 'Invalid or missing verification link.');
    return;
  }

  try {
    await verifyEmail(token);
    showSuccess(statusEl, 'Email verified! You can now log in.');
  } catch (err) {
    showError(statusEl, err.message || 'Verification failed. The link may have expired.');
  }
}

/**
 * Bind the reset-password-request form.
 */
function initResetRequestForm() {
  const form = document.querySelector('[data-kd="reset-request-form"]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('[data-kd="reset-email"]').value.trim();
    const btn = form.querySelector('[data-kd="reset-request-btn"]');

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await requestPasswordReset(email);
      showSuccess(form, 'Check your email for the reset link.');
    } catch (err) {
      showError(form, err.message || 'Failed to send reset email.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
    }
  });
}

/**
 * Bind the reset-password form (reads ?token= from URL).
 */
function initResetPasswordForm() {
  const form = document.querySelector('[data-kd="reset-password-form"]');
  if (!form) return;

  const token = getUrlParam('token');
  if (!token) {
    showError(form, 'Invalid or missing reset link.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = form.querySelector('[data-kd="new-password"]').value;
    const btn = form.querySelector('[data-kd="reset-password-btn"]');

    btn.disabled = true;
    btn.textContent = 'Resetting…';

    try {
      await resetPassword(token, password);
      showSuccess(form, 'Password updated! Redirecting to login…');
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err) {
      showError(form, err.message || 'Reset failed. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Reset Password';
    }
  });
}

/* ─────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────── */

window.login = login;
window.logout = logout;
window.checkAuth = checkAuth;
window.initLoginForm = initLoginForm;
window.initRegisterForm = initRegisterForm;

async function initAuth() {
  const path = window.location.pathname;

  // Always bind logout buttons (present in nav on all pages)
  initLogoutButtons();

  // Dashboard pages — run auth guard first, then page-specific init
  if (path.startsWith('/dashboard')) {
    const user = await checkAuth();
    if (!user) return; // checkAuth redirects on failure

    // Expose user globally for other modules (dashboard.js, etc.)
    window.KD_USER = user;
    return;
  }

  // Auth pages — no guard needed, just bind forms
  if (path.includes('/login')) {
    initLoginForm();
    return;
  }

  if (path.includes('/register') || path.includes('/signup')) {
    initRegisterForm();
    return;
  }

  if (path.includes('/verify-email')) {
    await initVerifyEmailPage();
    return;
  }

  if (path.includes('/reset-password-request') || path.includes('/forgot-password')) {
    initResetRequestForm();
    return;
  }

  if (path.includes('/reset-password')) {
    initResetPasswordForm();
    return;
  }
}

window.initAuth = initAuth;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
