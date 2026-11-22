// Port of EcoTapViewModel.kt. Plain JS with no React or native imports, so it runs (and is tested) under Node.
// The Kotlin StateFlows become one state object; screens read it through useKiosk() in useKiosk.js.
import { api as defaultApi, normalizeCardId } from './api.js';

export const AppMode = Object.freeze({
  NFC_SCAN: 'NFC_SCAN',
  REGISTRATION: 'REGISTRATION',
  PIN_ENTRY: 'PIN_ENTRY',
  MAIN_MENU: 'MAIN_MENU',
  CARD_INQUIRY: 'CARD_INQUIRY',
  REWARDS_POS: 'REWARDS_POS',
  DEPOSIT: 'DEPOSIT',
  POINT_CONVERSION: 'POINT_CONVERSION',
});

const ACTIVE_MODES = new Set([
  AppMode.MAIN_MENU, AppMode.CARD_INQUIRY, AppMode.REWARDS_POS, AppMode.DEPOSIT, AppMode.POINT_CONVERSION,
]);

const BANNER_MS = 10000;

export class KioskController {
  constructor(api = defaultApi) {
    this.api = api;
    this.loggedIn = false;
    this.listeners = new Set();
    this.bannerTimer = null;
    this.state = {
      currentMode: AppMode.NFC_SCAN,
      unregisteredNfcId: null,
      // On the PIN screen this is a stub (name + card only); after login it is the full resident.
      authenticatedUser: null,
      pinInput: '',
      pinError: null,
      banner: null,
      busy: false,
      rewards: [],
      deposits: [],
      redemptions: [],
      categories: [],
    };
    // Last, so every field above exists before the first request starts.
    this.refreshRewards();
  }

  // --- store plumbing (what StateFlow gave Compose) ---

  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getState = () => this.state;
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  dispose() { clearTimeout(this.bannerTimer); this.listeners.clear(); }

  // --- NFC ---

  /** Called when a physical card is tapped. */
  onNfcCardTapped = async (nfcCardId) => {
    if (this.state.busy) return;
    const tapped = normalizeCardId(nfcCardId);

    const current = this.state.authenticatedUser;
    if (this.loggedIn && current && ACTIVE_MODES.has(this.state.currentMode)
      && current.nfcCardId.toUpperCase() === tapped) {
      this.showBanner(`Active Session Confirmed: ${current.fullName}`);
      return;
    }

    this.set({ busy: true });
    try {
      const card = await this.api.lookupCard(tapped);
      if (card.registered) {
        this.api.clearSession();
        this.loggedIn = false;
        this.set({
          authenticatedUser: {
            id: '', nfcCardId: card.nfcCardId, fullName: card.fullName ?? 'Resident', address: '',
            barangay: card.barangay ?? '', ecoPoints: 0, totalWasteKg: 0, registeredDate: '',
          },
          pinInput: '', pinError: null, currentMode: AppMode.PIN_ENTRY,
        });
        this.showBanner(`NFC Card Recognized: ${card.fullName}`);
      } else {
        // New / unregistered card -> resident account creation
        this.set({ unregisteredNfcId: card.nfcCardId, currentMode: AppMode.REGISTRATION });
        this.showBanner(`New NFC Card Detected (${card.nfcCardId}). Set up your resident account!`);
      }
    } catch (e) {
      this.showBanner(e.message);
    }
    this.set({ busy: false });
  };

  createAccountAndLinkCard = async (fullName, address, pinCode) => {
    const nfcId = this.state.unregisteredNfcId;
    if (!nfcId || this.state.busy) return;
    this.set({ busy: true });
    try {
      const resident = await this.api.register(nfcId, fullName.trim(), address.trim(), pinCode);
      this.set({ unregisteredNfcId: null, currentMode: AppMode.NFC_SCAN });
      this.showBanner(`Account created for ${resident.fullName}! Tap your card again to log in.`);
    } catch (e) {
      this.showBanner(e.message);
    }
    this.set({ busy: false });
  };

  // --- PIN pad ---

  onPinDigitEntered = (digit) => {
    if (this.state.busy || this.state.pinInput.length >= 6) return;
    const pinInput = this.state.pinInput + digit;
    this.set({ pinInput, pinError: null });
    if (pinInput.length === 6) this.verifyPinAndProceed();
  };

  onPinBackspace = () => {
    if (this.state.pinInput.length > 0) this.set({ pinInput: this.state.pinInput.slice(0, -1), pinError: null });
  };

  onPinClear = () => this.set({ pinInput: '', pinError: null });

  async verifyPinAndProceed() {
    const stub = this.state.authenticatedUser;
    if (!stub) return;
    const pin = this.state.pinInput;
    this.set({ busy: true });
    try {
      const resident = await this.api.login(stub.nfcCardId, pin);
      this.loggedIn = true;
      this.set({ authenticatedUser: resident, pinError: null, pinInput: '', currentMode: AppMode.MAIN_MENU });
      this.showBanner(`Welcome, ${resident.fullName}!`);
      this.refreshAccount();
      this.refreshRewards();
      this.refreshCategories();
    } catch (e) {
      this.set({ pinError: e.message, pinInput: '' });
    }
    this.set({ busy: false });
  }

  // --- Navigation ---

  navigateTo = (mode) => {
    this.set({ currentMode: mode });
    if (this.loggedIn && (mode === AppMode.CARD_INQUIRY || mode === AppMode.REWARDS_POS)) {
      this.refreshAccount();
      if (mode === AppMode.REWARDS_POS) this.refreshRewards();
    }
    if (this.loggedIn && (mode === AppMode.DEPOSIT || mode === AppMode.POINT_CONVERSION)) {
      this.refreshCategories();
      if (mode === AppMode.POINT_CONVERSION) this.refreshRewards();
    }
  };

  logoutSession = (message = 'Session ended. Card ejected.') => {
    if (this.loggedIn) this.api.logout(); else this.api.clearSession();
    this.loggedIn = false;
    this.set({
      authenticatedUser: null, unregisteredNfcId: null, deposits: [], redemptions: [],
      pinInput: '', pinError: null, currentMode: AppMode.NFC_SCAN,
    });
    this.showBanner(message);
  };

  // --- Server data ---

  async refreshRewards() {
    try { this.set({ rewards: await this.api.getRewards() }); } catch (e) { this.showBanner(e.message); }
  }

  async refreshCategories() {
    try { this.set({ categories: await this.api.getCategories() }); } catch (e) { this.showBanner(e.message); }
  }

  async refreshAccount() {
    try {
      const account = await this.api.getAccount();
      this.set({ authenticatedUser: account.resident, deposits: account.deposits, redemptions: account.redemptions });
    } catch (e) { this.handleFailure(e); }
  }

  handleFailure(error) {
    if (error.status === 401) this.logoutSession('Session expired. Tap your card again.');
    else this.showBanner(error.message);
  }

  // --- Rewards POS ---

  redeemRewardItem = async (item) => {
    const user = this.state.authenticatedUser;
    if (!user || this.state.busy) return;
    if (user.ecoPoints < item.pointsCost) {
      this.showBanner(`Insufficient Eco-Points. Required: ${item.pointsCost}, Current: ${user.ecoPoints}`);
      return;
    }
    this.set({ busy: true });
    try {
      const result = await this.api.redeem(item);
      this.set({ authenticatedUser: result.resident, redemptions: [result.redemption, ...this.state.redemptions] });
      this.showBanner(`Redemption successful! ${item.pointsCost} points deducted. Show this to the staff to claim your item.`);
    } catch (e) { this.handleFailure(e); }
    this.set({ busy: false });
  };

  // --- Deposit segregated waste (select category -> machine weighs -> server awards points) ---

  /** Opens a deposit session for the category. Resolves to the session id, or null if it failed. */
  startDeposit = async (category) => {
    if (this.state.busy) return null;
    this.set({ busy: true });
    let sessionId = null;
    try { sessionId = (await this.api.startDeposit(category.id)).sessionId; } catch (e) { this.handleFailure(e); }
    this.set({ busy: false });
    return sessionId;
  };

  /**
   * Asks the server whether the machine has reported the measured weight yet. Resolves to the status, or null.
   * On "completed" the balance and history come from the server's response before this resolves.
   */
  checkDeposit = async (sessionId) => {
    try {
      const status = await this.api.depositStatus(sessionId);
      const deposit = status.deposit;
      if (status.status === 'completed' && deposit) {
        const patch = { deposits: [deposit, ...this.state.deposits.filter((d) => d.id !== deposit.id)] };
        if (status.resident) patch.authenticatedUser = status.resident;
        this.set(patch);
        this.showBanner(`Deposit recorded: +${deposit.pointsEarned} Eco-Points.`);
      }
      return status;
    } catch (e) {
      if (e.status === 401) this.handleFailure(e);
      return null;
    }
  };

  cancelDeposit = async (sessionId) => {
    try { await this.api.cancelDeposit(sessionId); } catch { /* it expires by itself */ }
  };

  // --- Card inquiry ---

  /** Resolves true when the PIN was changed. */
  updatePin = async (newPin) => {
    if (this.state.busy) return false;
    this.set({ busy: true });
    let ok = false;
    try { await this.api.changePin(newPin); this.showBanner('PIN updated.'); ok = true; } catch (e) { this.handleFailure(e); }
    this.set({ busy: false });
    return ok;
  };

  // --- Banner ---

  showBanner = (message) => {
    this.set({ banner: message });
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      if (this.state.banner === message) this.set({ banner: null });
    }, BANNER_MS);
  };

  clearBanner = () => {
    clearTimeout(this.bannerTimer);
    this.set({ banner: null });
  };
}
