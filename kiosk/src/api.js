// Port of ApiService.kt + ApiClient.kt + the call() wrapper in EcoTapRepository.kt.
// Every request sends X-Kiosk-Key; once a resident is signed in it also sends the bearer token (kept in memory only).
import { BASE_URL, KIOSK_API_KEY } from './config.js';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = never reached the server
  }
}

/** "8a19b" -> "ECO-TAP-8A19B". Matches the server's normalisation. */
export function normalizeCardId(raw) {
  const id = String(raw ?? '').trim().toUpperCase();
  return id.startsWith('ECO-TAP-') ? id : `ECO-TAP-${id}`;
}

/** Pulls the server's {"error": "..."} text out of an error body. */
export function parseErrorMessage(body, fallback) {
  if (!body || !String(body).trim()) return fallback;
  try {
    const message = JSON.parse(body)?.error;
    return typeof message === 'string' && message.trim() ? message : fallback;
  } catch {
    return fallback;
  }
}

/** Replaces Kotlin's UUID.randomUUID() for the redeem idempotency key. */
export function newIdempotencyKey() {
  return `kiosk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const session = { token: null };
/** Holds the signed-in resident's bearer token (memory only), like SessionStore. */
export const SessionStore = {
  get token() { return session.token; },
  set token(value) { session.token = value; },
};

const TIMEOUT_MS = 15000;

async function call(method, path, body, fetchImpl = fetch) {
  const headers = { Accept: 'application/json', 'X-Kiosk-Key': KIOSK_API_KEY };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  let text = '';
  try {
    res = await fetchImpl(`${BASE_URL.replace(/\/+$/, '')}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
    text = await res.text();
  } catch {
    throw new ApiError('Cannot reach the ECO-TAP server. Check the connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (res.ok && data != null) return data;
  throw new ApiError(parseErrorMessage(res.ok ? null : text, `Server error (${res.status}).`), res.status);
}

export const api = {
  health: () => call('GET', '/api/kiosk/health'),
  getRewards: () => call('GET', '/api/kiosk/rewards').then((d) => d.rewards),
  getCategories: () => call('GET', '/api/kiosk/categories').then((d) => d.categories),
  startDeposit: (categoryId) => call('POST', '/api/kiosk/deposit/start', { categoryId }),
  depositStatus: (sessionId) => call('GET', `/api/kiosk/deposit/${encodeURIComponent(sessionId)}`),
  cancelDeposit: (sessionId) => call('POST', `/api/kiosk/deposit/${encodeURIComponent(sessionId)}/cancel`, {}),
  lookupCard: (nfcCardId) => call('POST', '/api/kiosk/card', { nfcCardId: normalizeCardId(nfcCardId) }),
  register: (nfcCardId, fullName, address, pin) =>
    call('POST', '/api/kiosk/register', { nfcCardId: normalizeCardId(nfcCardId), fullName, address, pin }).then((d) => d.resident),
  login: (nfcCardId, pin) =>
    call('POST', '/api/kiosk/login', { nfcCardId: normalizeCardId(nfcCardId), pin }).then((d) => {
      session.token = d.token;
      return d.resident;
    }),
  logout: async () => {
    try { await call('POST', '/api/kiosk/logout', {}); } catch { /* the token is dropped locally either way */ }
    session.token = null;
  },
  clearSession: () => { session.token = null; },
  getAccount: () => call('GET', '/api/kiosk/me'),
  changePin: (newPin) => {
    if (!/^\d{6}$/.test(newPin)) return Promise.reject(new ApiError('PIN must be 6 digits.'));
    return call('PUT', '/api/kiosk/pin', { pin: newPin }).then(() => true);
  },
  redeem: (item, idempotencyKey = newIdempotencyKey()) => call('POST', '/api/kiosk/redeem', { itemId: item.id, idempotencyKey }),
};
