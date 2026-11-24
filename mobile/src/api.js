// Client for the ECO-TAP kiosk API (server/index.mjs, /api/kiosk/*).
// Every call sends X-Kiosk-Key; resident calls also send the bearer token from login.

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').trim().replace(/\/+$/, '');
const kioskKey = (process.env.EXPO_PUBLIC_KIOSK_KEY || '').trim();
const state = { token: null, onUnauthorized: null };

export function setToken(token) { state.token = token; }
export function hasToken() { return Boolean(state.token); }
export function setUnauthorizedHandler(fn) { state.onUnauthorized = fn; }

async function request(method, path, body, { timeoutMs = 15000, session = true } = {}) {
  if (!baseUrl) throw new ApiError('The ECO-TAP server address is missing from this app build.');
  const headers = { Accept: 'application/json', 'X-Kiosk-Key': kioskKey };
  const requestToken = session ? state.token : null;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(error?.name === 'AbortError'
      ? 'The server took too long to answer. Please try again.'
      : 'Cannot reach the ECO-TAP server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status}).`;
    // A 401 on a signed-in call means the 15-minute resident session ended.
    if (res.status === 401 && requestToken && state.token === requestToken) state.onUnauthorized?.(message);
    throw new ApiError(message, res.status);
  }
  return data;
}

export const api = {
  health: () => request('GET', '/api/kiosk/health', undefined, { session: false, timeoutMs: 8000 }),
  rewards: () => request('GET', '/api/kiosk/rewards', undefined, { session: false }).then((d) => d.rewards),
  stations: () => request('GET', '/api/kiosk/stations', undefined, { session: false }).then((d) => d.stations),
  lookupCard: (nfcCardId) => request('POST', '/api/kiosk/card', { nfcCardId }, { session: false }),
  register: (body) => request('POST', '/api/kiosk/register', body, { session: false }),
  login: (nfcCardId, pin) => request('POST', '/api/kiosk/login', { nfcCardId, pin }, { session: false }),
  logout: () => request('POST', '/api/kiosk/logout', {}),
  me: () => request('GET', '/api/kiosk/me'),
  notifications: () => request('GET', '/api/kiosk/notifications').then((data) => data.notifications),
  changePin: (pin) => request('PUT', '/api/kiosk/pin', { pin }),
  redeem: (itemId, idempotencyKey) => request('POST', '/api/kiosk/redeem', { itemId, idempotencyKey }),
};

export function normalizeCardId(value) {
  const card = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(card)) return '';
  return card.startsWith('ECO-TAP-') ? card : `ECO-TAP-${card}`;
}

export function newIdempotencyKey(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
