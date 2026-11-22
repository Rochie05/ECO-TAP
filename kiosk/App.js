// Port of MainActivity.kt: NFC reader lifecycle, header + banner, and the screen switch on the current mode.
import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMode } from './src/controller';
import { useKiosk } from './src/useKiosk';
import { disableReaderMode, enableReaderMode } from './src/nfc';
import { BannerNotification, KioskHeader } from './src/components';
import { C } from './src/theme';
import NfcScanScreen from './src/screens/NfcScanScreen';
import RegisterResidentScreen from './src/screens/RegisterResidentScreen';
import PinEntryScreen from './src/screens/PinEntryScreen';
import KioskMenuScreen from './src/screens/KioskMenuScreen';
import CardInquiryScreen from './src/screens/CardInquiryScreen';
import RewardsPosScreen from './src/screens/RewardsPosScreen';
import DepositScreen from './src/screens/DepositScreen';
import PointConversionScreen from './src/screens/PointConversionScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <Kiosk />
    </SafeAreaProvider>
  );
}

const NEEDS_USER = new Set([
  AppMode.PIN_ENTRY, AppMode.MAIN_MENU, AppMode.CARD_INQUIRY, AppMode.REWARDS_POS, AppMode.DEPOSIT, AppMode.POINT_CONVERSION,
]);
const SERVICE_MODES = new Set([AppMode.CARD_INQUIRY, AppMode.REWARDS_POS, AppMode.DEPOSIT, AppMode.POINT_CONVERSION]);

function Kiosk() {
  const insets = useSafeAreaInsets();
  const [state, kiosk] = useKiosk();
  const { currentMode: mode, authenticatedUser: user } = state;

  // NFC: read cards while the app is in the foreground (Kotlin onResume / onPause).
  const onCard = useCallback((id) => kiosk.onNfcCardTapped(id), [kiosk]);
  useEffect(() => {
    let active = AppState.currentState === 'active';
    if (active) enableReaderMode(onCard);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !active) enableReaderMode(onCard);
      if (next !== 'active' && active) disableReaderMode();
      active = next === 'active';
    });
    return () => { sub.remove(); disableReaderMode(); };
  }, [onCard]);

  // A screen that needs a resident but has none goes back to the tap screen.
  useEffect(() => {
    if (!user && NEEDS_USER.has(mode)) kiosk.navigateTo(AppMode.NFC_SCAN);
  }, [user, mode, kiosk]);

  // Android back: from a service screen go to the menu; everywhere else keep the default.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (SERVICE_MODES.has(modeRef.current)) { kiosk.navigateTo(AppMode.MAIN_MENU); return true; }
      return false;
    });
    return () => sub.remove();
  }, [kiosk]);

  let screen = null;
  if (mode === AppMode.NFC_SCAN) {
    screen = <NfcScanScreen />;
  } else if (mode === AppMode.REGISTRATION) {
    screen = (
      <RegisterResidentScreen
        scannedNfcCardId={state.unregisteredNfcId ?? 'ECO-TAP-NFC'}
        onCreateAccount={kiosk.createAccountAndLinkCard}
        onCancel={() => kiosk.navigateTo(AppMode.NFC_SCAN)}
      />
    );
  } else if (user) {
    const back = () => kiosk.navigateTo(AppMode.MAIN_MENU);
    if (mode === AppMode.PIN_ENTRY) {
      screen = (
        <PinEntryScreen
          user={user}
          pinInput={state.pinInput}
          errorMessage={state.pinError}
          onDigitEntered={kiosk.onPinDigitEntered}
          onBackspace={kiosk.onPinBackspace}
          onClear={kiosk.onPinClear}
          onCancel={() => kiosk.logoutSession()}
        />
      );
    } else if (mode === AppMode.MAIN_MENU) {
      screen = <KioskMenuScreen user={user} onNavigate={kiosk.navigateTo} />;
    } else if (mode === AppMode.CARD_INQUIRY) {
      screen = (
        <CardInquiryScreen user={user} deposits={state.deposits} redemptions={state.redemptions} onUpdatePin={kiosk.updatePin} onBackToMenu={back} />
      );
    } else if (mode === AppMode.REWARDS_POS) {
      screen = <RewardsPosScreen user={user} rewardItems={state.rewards} onRedeemItem={kiosk.redeemRewardItem} onBackToMenu={back} />;
    } else if (mode === AppMode.DEPOSIT) {
      screen = (
        <DepositScreen
          user={user}
          categories={state.categories}
          ausy={state.ausy}
          onStart={kiosk.startDeposit}
          onPoll={kiosk.checkDeposit}
          onCancel={kiosk.cancelDeposit}
          onBackToMenu={back}
        />
      );
    } else if (mode === AppMode.POINT_CONVERSION) {
      screen = <PointConversionScreen user={user} categories={state.categories} rewardItems={state.rewards} onBackToMenu={back} />;
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surfaceBg} translucent />
      <KioskHeader currentMode={mode} user={user} onLogout={() => kiosk.logoutSession()} topInset={insets.top} />
      <View style={[s.body, { paddingBottom: insets.bottom }]}>
        <BannerNotification message={state.banner} onDismiss={kiosk.clearBanner} />
        {screen}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surfaceBg },
  body: { flex: 1 },
});
