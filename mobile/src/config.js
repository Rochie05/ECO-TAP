import * as SecureStore from 'expo-secure-store';

// Defaults come from mobile/.env (EXPO_PUBLIC_* values are baked into the bundle at build time).
// 10.0.2.2 is the Android emulator's alias for the PC that runs the emulator.
export const DEFAULTS = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  kioskKey: process.env.EXPO_PUBLIC_KIOSK_KEY || '',
};

const SETTINGS_KEY = 'ecotap.settings';
const CARD_KEY = 'ecotap.lastCard';

export function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export async function loadSettings() {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return {
      baseUrl: cleanBaseUrl(saved.baseUrl) || cleanBaseUrl(DEFAULTS.baseUrl),
      kioskKey: saved.kioskKey ?? DEFAULTS.kioskKey,
    };
  } catch {
    return { baseUrl: cleanBaseUrl(DEFAULTS.baseUrl), kioskKey: DEFAULTS.kioskKey };
  }
}

export async function saveSettings(settings) {
  const value = { baseUrl: cleanBaseUrl(settings.baseUrl), kioskKey: String(settings.kioskKey || '').trim() };
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(value));
  return value;
}

// Only the card ID is remembered. The PIN and the session token are never written to disk.
export async function loadLastCard() {
  try { return (await SecureStore.getItemAsync(CARD_KEY)) || ''; } catch { return ''; }
}
export async function saveLastCard(card) {
  try { await SecureStore.setItemAsync(CARD_KEY, card); } catch { /* not critical */ }
}
export async function clearLastCard() {
  try { await SecureStore.deleteItemAsync(CARD_KEY); } catch { /* not critical */ }
}
