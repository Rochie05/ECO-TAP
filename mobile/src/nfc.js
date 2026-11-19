// Reads the UID of an ECO-TAP card with the phone's NFC reader, formatted like the kiosk app (ECO-TAP-<UID>).
// react-native-nfc-manager is a native module: it works in a development build or an APK, not in Expo Go.
let Nfc = null;
let Events = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('react-native-nfc-manager');
  Nfc = mod.default;
  Events = mod.NfcEvents;
} catch { /* module not linked */ }

export async function nfcStatus() {
  try {
    if (!Nfc || !(await Nfc.isSupported())) return 'unavailable';
    await Nfc.start();
    return (await Nfc.isEnabled()) ? 'ready' : 'disabled';
  } catch {
    return 'unavailable';
  }
}

export function openNfcSettings() {
  try { Nfc?.goToNfcSetting(); } catch { /* ignore */ }
}

/** Starts listening for a card. Returns a function that stops listening. */
export async function startCardReader(onCard) {
  if (!Nfc) throw new Error('NFC is not available in this build.');
  await Nfc.start();
  Nfc.setEventListener(Events.DiscoverTag, (tag) => {
    const uid = String(tag?.id || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (uid) onCard(`ECO-TAP-${uid}`);
  });
  await Nfc.registerTagEvent();
  return async () => {
    try { Nfc.setEventListener(Events.DiscoverTag, null); await Nfc.unregisterTagEvent(); } catch { /* ignore */ }
  };
}
