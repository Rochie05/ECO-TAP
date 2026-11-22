// Drives KioskController (the ViewModel port) against a fake server API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KioskController, AppMode } from '../src/controller.js';
import { ApiError } from '../src/api.js';

const resident = { id: 'r1', nfcCardId: 'ECO-TAP-AB12', fullName: 'Juan Dela Cruz', address: 'QC', barangay: 'Central', ecoPoints: 120, totalWasteKg: 4.5, registeredDate: '' };
const rewards = [{ id: 'g1', title: 'Rice 1kg', description: '', pointsCost: 100, category: '', iconName: 'rice' }, { id: 'g2', title: 'Oil', description: '', pointsCost: 500, category: '', iconName: 'oil' }];
const categories = [{ id: 'PET', name: 'PET bottles', section: 'b1', pointsPerKg: 10 }];

function fakeApi(overrides = {}) {
  const calls = [];
  const api = {
    calls,
    getRewards: async () => rewards,
    getCategories: async () => categories,
    lookupCard: async (id) => (id === 'ECO-TAP-AB12'
      ? { nfcCardId: id, registered: true, fullName: 'Juan Dela Cruz', barangay: 'Central' }
      : { nfcCardId: id, registered: false }),
    register: async () => resident,
    login: async (id, pin) => { calls.push(['login', id, pin]); if (pin !== '123456') throw new ApiError('Invalid 6-digit PIN. Please try again.', 401); return resident; },
    logout: async () => { calls.push(['logout']); },
    clearSession: () => calls.push(['clear']),
    getAccount: async () => ({ resident, deposits: [], redemptions: [] }),
    redeem: async (item) => ({ resident: { ...resident, ecoPoints: resident.ecoPoints - item.pointsCost }, redemption: { id: 'x1', userId: 'r1', itemTitle: item.title, pointsDeducted: item.pointsCost, timestamp: 1 }, duplicate: false }),
    startDeposit: async () => ({ sessionId: 's1' }),
    depositStatus: async () => ({ sessionId: 's1', status: 'open' }),
    cancelDeposit: async () => ({ ok: true }),
    changePin: async () => true,
    ...overrides,
  };
  return api;
}
const settle = () => new Promise((r) => setTimeout(r, 0));

async function signIn(kiosk) {
  await kiosk.onNfcCardTapped('ab12');
  '123456'.split('').forEach(kiosk.onPinDigitEntered);
  await settle(); await settle();
}

test('known card goes to the PIN pad with a stub user', async () => {
  const kiosk = new KioskController(fakeApi());
  await kiosk.onNfcCardTapped('ab12');
  const s = kiosk.getState();
  assert.equal(s.currentMode, AppMode.PIN_ENTRY);
  assert.equal(s.authenticatedUser.fullName, 'Juan Dela Cruz');
  assert.equal(s.authenticatedUser.ecoPoints, 0);
  kiosk.dispose();
});

test('unknown card goes to registration, then back to the tap screen', async () => {
  const kiosk = new KioskController(fakeApi());
  await kiosk.onNfcCardTapped('ECO-TAP-NEW1');
  assert.equal(kiosk.getState().currentMode, AppMode.REGISTRATION);
  assert.equal(kiosk.getState().unregisteredNfcId, 'ECO-TAP-NEW1');
  await kiosk.createAccountAndLinkCard('  Ana  ', ' QC ', '654321');
  assert.equal(kiosk.getState().currentMode, AppMode.NFC_SCAN);
  assert.match(kiosk.getState().banner, /Account created for Juan Dela Cruz/);
  kiosk.dispose();
});

test('6 correct digits log in and load the account', async () => {
  const api = fakeApi();
  const kiosk = new KioskController(api);
  await signIn(kiosk);
  const s = kiosk.getState();
  assert.equal(s.currentMode, AppMode.MAIN_MENU);
  assert.equal(s.authenticatedUser.ecoPoints, 120);
  assert.equal(s.pinInput, '');
  assert.deepEqual(api.calls.find((c) => c[0] === 'login'), ['login', 'ECO-TAP-AB12', '123456']);
  assert.equal(s.categories.length, 1);
  kiosk.dispose();
});

test('wrong PIN shows the server message and clears the pad', async () => {
  const kiosk = new KioskController(fakeApi());
  await kiosk.onNfcCardTapped('ab12');
  '111111'.split('').forEach(kiosk.onPinDigitEntered);
  await settle(); await settle();
  assert.equal(kiosk.getState().currentMode, AppMode.PIN_ENTRY);
  assert.equal(kiosk.getState().pinError, 'Invalid 6-digit PIN. Please try again.');
  assert.equal(kiosk.getState().pinInput, '');
  kiosk.dispose();
});

test('PIN pad ignores a 7th digit and backspace/clear work', () => {
  const kiosk = new KioskController(fakeApi());
  kiosk.set({ authenticatedUser: resident, currentMode: AppMode.PIN_ENTRY });
  '12'.split('').forEach(kiosk.onPinDigitEntered);
  kiosk.onPinBackspace();
  assert.equal(kiosk.getState().pinInput, '1');
  kiosk.onPinClear();
  assert.equal(kiosk.getState().pinInput, '');
  kiosk.dispose();
});

test('tapping the same card while signed in only confirms the session', async () => {
  const api = fakeApi();
  const kiosk = new KioskController(api);
  await signIn(kiosk);
  const before = api.calls.length;
  await kiosk.onNfcCardTapped('ECO-TAP-ab12');
  assert.match(kiosk.getState().banner, /Active Session Confirmed: Juan Dela Cruz/);
  assert.equal(api.calls.length, before);
  assert.equal(kiosk.getState().currentMode, AppMode.MAIN_MENU);
  kiosk.dispose();
});

test('redeem blocks when points are short, and deducts when enough', async () => {
  const kiosk = new KioskController(fakeApi());
  await signIn(kiosk);
  await kiosk.redeemRewardItem(rewards[1]);
  assert.match(kiosk.getState().banner, /Insufficient Eco-Points. Required: 500, Current: 120/);
  await kiosk.redeemRewardItem(rewards[0]);
  assert.equal(kiosk.getState().authenticatedUser.ecoPoints, 20);
  assert.equal(kiosk.getState().redemptions.length, 1);
  assert.match(kiosk.getState().banner, /Redemption successful! 100 points deducted/);
  kiosk.dispose();
});

test('deposit: start returns the session id; completed status updates balance and ledger', async () => {
  const deposit = { id: 'd1', userId: 'r1', categoryName: 'PET bottles', weightKg: 1.25, pointsEarned: 13, timestamp: 2 };
  const kiosk = new KioskController(fakeApi({
    depositStatus: async () => ({ sessionId: 's1', status: 'completed', deposit, resident: { ...resident, ecoPoints: 133 } }),
  }));
  await signIn(kiosk);
  assert.equal(await kiosk.startDeposit(categories[0]), 's1');
  const status = await kiosk.checkDeposit('s1');
  assert.equal(status.status, 'completed');
  assert.equal(kiosk.getState().authenticatedUser.ecoPoints, 133);
  assert.deepEqual(kiosk.getState().deposits.map((d) => d.id), ['d1']);
  assert.equal(kiosk.getState().banner, 'Deposit recorded: +13 Eco-Points.');
  kiosk.dispose();
});

test('a 401 anywhere ends the session', async () => {
  const kiosk = new KioskController(fakeApi({ redeem: async () => { throw new ApiError('Session expired', 401); } }));
  await signIn(kiosk);
  await kiosk.redeemRewardItem(rewards[0]);
  assert.equal(kiosk.getState().currentMode, AppMode.NFC_SCAN);
  assert.equal(kiosk.getState().authenticatedUser, null);
  assert.equal(kiosk.getState().banner, 'Session expired. Tap your card again.');
  kiosk.dispose();
});

test('logout clears the resident and returns to the tap screen', async () => {
  const api = fakeApi();
  const kiosk = new KioskController(api);
  await signIn(kiosk);
  kiosk.logoutSession();
  const s = kiosk.getState();
  assert.equal(s.currentMode, AppMode.NFC_SCAN);
  assert.equal(s.authenticatedUser, null);
  assert.equal(s.banner, 'Session ended. Card ejected.');
  assert.ok(api.calls.some((c) => c[0] === 'logout'));
  kiosk.dispose();
});

test('changePin reports success and failure', async () => {
  const ok = new KioskController(fakeApi());
  assert.equal(await ok.updatePin('123456'), true);
  const bad = new KioskController(fakeApi({ changePin: async () => { throw new ApiError('PIN must be 6 digits.'); } }));
  assert.equal(await bad.updatePin('12'), false);
  ok.dispose(); bad.dispose();
});

test('banner clears itself after 10 seconds, but not if replaced', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const kiosk = new KioskController(fakeApi());
  kiosk.showBanner('one');
  t.mock.timers.tick(9000);
  kiosk.showBanner('two');
  t.mock.timers.tick(9000);
  assert.equal(kiosk.getState().banner, 'two');
  t.mock.timers.tick(1500);
  assert.equal(kiosk.getState().banner, null);
  kiosk.dispose();
});
