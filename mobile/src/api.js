// Client for the ECO-TAP kiosk API (server/index.mjs, /api/kiosk/*).
// Every call sends X-Kiosk-Key; resident calls also send the bearer token from login.

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}

const state = { baseUrl: '', kioskKey: '', token: null, onUnauthorized: null };

export function configure({ baseUrl, kioskKey }) {
  state.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
  state.kioskKey = kioskKey || '';
}
export function setToken(token) { state.token = token; }
export function hasToken() { return Boolean(state.token); }
export function setUnauthorizedHandler(fn) { state.onUnauthorized = fn; }

async function request(method, path, body, { timeoutMs = 15000, session = true } = {}) {
  if (!state.baseUrl) throw new ApiError('Set the ECO-TAP server address in Server settings.');
  const headers = { Accept: 'application/json', 'X-Kiosk-Key': state.kioskKey };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session && state.token) headers.Authorization = `Bearer ${state.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${state.baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(error?.name === 'AbortError'
      ? 'The server took too long to answer. Please try again.'
      : 'Cannot reach the ECO-TAP server. Check your connection and the server address.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status}).`;
    // A 401 on a signed-in call means the 15-minute resident session ended.
    if (res.status === 401 && session && state.token) state.onUnauthorized?.(message);
    throw new ApiError(message, res.status);
  }
  return data;
}

export const api = {
  health: () => request('GET', '/api/kiosk/health', undefined, { session: false, timeoutMs: 8000 }),
  rewards: () => request('GET', '/api/kiosk/rewards', undefined, { session: false }).then((d) => d.rewards),
  categories: () => request('GET', '/api/kiosk/categories', undefined, { session: false }).then((d) => d.categories),
  stations: () => request('GET', '/api/kiosk/stations', undefined, { session: false }).then((d) => d.stations),
  lookupCard: (nfcCardId) => request('POST', '/api/kiosk/card', { nfcCardId }, { session: false }),
  register: (body) => request('POST', '/api/kiosk/register', body, { session: false }),
  login: (nfcCardId, pin) => request('POST', '/api/kiosk/login', { nfcCardId, pin }, { session: false }),
  logout: () => request('POST', '/api/kiosk/logout', {}),
  me: () => request('GET', '/api/kiosk/me'),
  changePin: (pin) => request('PUT', '/api/kiosk/pin', { pin }),
  redeem: (itemId, idempotencyKey) => request('POST', '/api/kiosk/redeem', { itemId, idempotencyKey }),
  startDeposit: (categoryId) => request('POST', '/api/kiosk/deposit/start', { categoryId }),
  depositStatus: (sessionId) => request('GET', `/api/kiosk/deposit/${encodeURIComponent(sessionId)}`),
  cancelDeposit: (sessionId) => request('POST', `/api/kiosk/deposit/${encodeURIComponent(sessionId)}/cancel`, {}),
};

export function normalizeCardId(value) {
  const card = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(card)) return '';
  return card.startsWith('ECO-TAP-') ? card : `ECO-TAP-${card}`;
}

export function newIdempotencyKey(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
