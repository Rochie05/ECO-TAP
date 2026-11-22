import * as SecureStore from 'expo-secure-store';

const CARD_KEY = 'ecotap.lastCard';

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
