// The HTTP layer against a fake fetch: headers, bearer token, error bodies, unreachable server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, SessionStore, ApiError } from '../src/api.js';

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const { status = 200, body } = await handler(url, init);
    return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
  return calls;
}

test('sends the kiosk key, and the bearer token once logged in', async () => {
  SessionStore.token = null;
  const calls = stubFetch((url) => (url.endsWith('/login')
    ? { body: { token: 'tok123', resident: { id: 'r1' } } }
    : { body: { resident: {}, deposits: [], redemptions: [] } }));
  await api.login('8a19b', '123456');
  assert.equal(calls[0].url, 'http://10.0.2.2:3000/api/kiosk/login');
  assert.equal(calls[0].init.headers['X-Kiosk-Key'], 'change-me');
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), { nfcCardId: 'ECO-TAP-8A19B', pin: '123456' });
  await api.getAccount();
  assert.equal(calls[1].init.headers.Authorization, 'Bearer tok123');
  await api.logout();
  assert.equal(SessionStore.token, null);
});

test('server error text and status come through ApiError', async () => {
  stubFetch(() => ({ status: 401, body: { error: 'Invalid 6-digit PIN. Please try again.' } }));
  await assert.rejects(api.lookupCard('x1'), (e) => e instanceof ApiError && e.status === 401 && e.message === 'Invalid 6-digit PIN. Please try again.');
});

test('non-JSON error body falls back to "Server error (code)."', async () => {
  stubFetch(() => ({ status: 502, body: '<html>bad gateway</html>' }));
  await assert.rejects(api.getRewards(), (e) => e.status === 502 && e.message === 'Server error (502).');
});

test('unreachable server gives the friendly message with status 0', async () => {
  globalThis.fetch = async () => { throw new TypeError('Network request failed'); };
  await assert.rejects(api.getCategories(), (e) => e.status === 0 && /Cannot reach the ECO-TAP server/.test(e.message));
});

test('redeem sends a fresh idempotency key each time; deposit ids are URL-encoded', async () => {
  const calls = stubFetch(() => ({ body: { ok: true } }));
  await api.redeem({ id: 'g1' }); await api.redeem({ id: 'g1' });
  const k1 = JSON.parse(calls[0].init.body).idempotencyKey; const k2 = JSON.parse(calls[1].init.body).idempotencyKey;
  assert.notEqual(k1, k2);
  await api.depositStatus('a/b');
  assert.ok(calls[2].url.endsWith('/api/kiosk/deposit/a%2Fb'));
});

test('changePin rejects non-6-digit PINs without calling the server', async () => {
  const calls = stubFetch(() => ({ body: { ok: true } }));
  await assert.rejects(api.changePin('12'), /PIN must be 6 digits/);
  assert.equal(calls.length, 0);
});
