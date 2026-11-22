// Port of NfcManager.kt. Reads the card UID and reports it as "ECO-TAP-<UID>".
// react-native-nfc-manager is native code: it works in a development build or an APK, not in Expo Go.
let Nfc = null;
let Events = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('react-native-nfc-manager');
  Nfc = mod.default;
  Events = mod.NfcEvents;
} catch { /* module not linked */ }

// android.nfc.NfcAdapter reader-mode flags, as in the Kotlin enableReaderMode().
const FLAG_READER_NFC_A = 0x1;
const FLAG_READER_NFC_B = 0x2;
const FLAG_READER_NFC_F = 0x4;
const FLAG_READER_NFC_V = 0x8;
const FLAG_READER_SKIP_NDEF_CHECK = 0x80;
const PRESENCE_CHECK_DELAY_MS = 250;

/** The tag id bytes as hex, e.g. "04A1B2C3" -> "ECO-TAP-04A1B2C3". Empty id -> null. */
export function cardIdFromTag(tag) {
  const uid = String(tag?.id || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return uid ? `ECO-TAP-${uid}` : null;
}

/** 'ready' | 'disabled' | 'unavailable' (the Kotlin isNfcAvailable / isNfcEnabled). */
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

/** enableReaderMode(): start listening for cards. Resolves true when the reader is running. */
export async function enableReaderMode(onCard) {
  if (!Nfc) return false;
  try {
    await Nfc.start();
    Nfc.setEventListener(Events.DiscoverTag, (tag) => {
      const id = cardIdFromTag(tag);
      if (id) onCard(id);
    });
    await Nfc.registerTagEvent({
      isReaderModeEnabled: true,
      readerModeFlags: FLAG_READER_NFC_A | FLAG_READER_NFC_B | FLAG_READER_NFC_F | FLAG_READER_NFC_V | FLAG_READER_SKIP_NDEF_CHECK,
      readerModeDelay: PRESENCE_CHECK_DELAY_MS,
    });
    return true;
  } catch {
    return false;
  }
}

/** disableReaderMode(): stop listening (app in the background). */
export async function disableReaderMode() {
  if (!Nfc) return;
  try {
    Nfc.setEventListener(Events.DiscoverTag, null);
    await Nfc.unregisterTagEvent();
  } catch { /* ignore */ }
}
