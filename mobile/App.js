import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, configure, setToken, setUnauthorizedHandler } from './src/api';
import { loadSettings } from './src/config';
import { useDeposit } from './src/useDeposit';
import { Banner } from './src/components';
import { C } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import DepositScreen from './src/screens/DepositScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const TABS = [
  ['home', 'Home', '⌂'], ['scan', 'Deposit', '◎'], ['rewards', 'Rewards', '◇'],
  ['activity', 'Activity', '≡'], ['profile', 'Profile', '◯'],
];

export default function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}

function Root() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);
  const [resident, setResident] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [tab, setTab] = useState('home');
  const [authNotice, setAuthNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Shared lists. null = still loading, [] = loaded but empty.
  const [categories, setCategories] = useState(null);
  const [categoriesError, setCategoriesError] = useState('');
  const [stations, setStations] = useState(null);
  const [stationsError, setStationsError] = useState('');
  const [rewards, setRewards] = useState(null);
  const [rewardsError, setRewardsError] = useState('');

  useEffect(() => {
    loadSettings().then((loaded) => { configure(loaded); setSettings(loaded); });
  }, []);

  const loadAccount = useCallback(async () => {
    const data = await api.me();
    setResident(data.resident);
    setDeposits(data.deposits);
    setRedemptions(data.redemptions);
  }, []);

  const loadLists = useCallback(() => {
    api.categories().then((v) => { setCategories(v); setCategoriesError(''); }).catch((e) => setCategoriesError(e.message));
    api.stations().then((v) => { setStations(v); setStationsError(''); }).catch((e) => setStationsError(e.message));
    api.rewards().then((v) => { setRewards(v); setRewardsError(''); }).catch((e) => setRewardsError(e.message));
  }, []);

  // When the machine reports a finished deposit the status carries the new balance; refresh the history too.
  const deposit = useDeposit({
    onCompleted: (status) => { if (status.resident) setResident(status.resident); loadAccount().catch(() => {}); loadLists(); },
  });
  const depositReset = deposit.reset;

  const clearSession = useCallback((message = '') => {
    setToken(null);
    setResident(null); setDeposits([]); setRedemptions([]);
    setTab('home');
    depositReset();
    setAuthNotice(message);
  }, [depositReset]);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    clearSession('');
  }, [clearSession]);

  // The server drops a resident session after 15 minutes without activity.
  useEffect(() => { setUnauthorizedHandler((message) => clearSession(message || 'Your session ended. Please sign in again.')); }, [clearSession]);

  const onAuthenticated = useCallback((signedIn) => {
    setAuthNotice('');
    setResident(signedIn);
    setCategories(null); setStations(null); setRewards(null);
    loadAccount().catch(() => {});
    loadLists();
  }, [loadAccount, loadLists]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try { await loadAccount(); } catch { /* 401 is handled globally */ }
    loadLists();
    setRefreshing(false);
  }, [loadAccount, loadLists]);

  // Android back button: go to Home first, then leave the app.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tabRef.current !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);

  if (!settings) {
    return <View style={[s.root, s.center]}><ActivityIndicator color={C.forest} size="large" /></View>;
  }

  const signedIn = Boolean(resident);
  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top }]} behavior="padding">
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
      <View style={s.topbar}>
        <View style={s.brandRow}><View style={s.brandMark}><Text style={s.brandSymbol}>↻</Text></View><Text style={s.brand}>ECO-TAP</Text></View>
        {signedIn ? (
          <Pressable onPress={() => setTab('profile')} accessibilityRole="button" accessibilityLabel="Profile" style={s.avatar}>
            <Text style={s.avatarText}>{resident.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, !signedIn && { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.forest} colors={[C.forest]} /> : undefined}>
        {!signedIn && (
          <AuthScreen settings={settings} onSettings={setSettings} onAuthenticated={onAuthenticated} notice={authNotice} />
        )}
        {signedIn && tab === 'home' && (
          <HomeScreen resident={resident} deposits={deposits} stations={stations} stationsError={stationsError} goTo={setTab} />
        )}
        {signedIn && tab === 'scan' && (
          <DepositScreen deposit={deposit} categories={categories} categoriesError={categoriesError} stations={stations} stationsError={stationsError} />
        )}
        {signedIn && tab === 'rewards' && (
          <RewardsScreen resident={resident} rewards={rewards} rewardsError={rewardsError} reload={loadLists}
            onRedeemed={(updated) => { setResident(updated); loadAccount().catch(() => {}); }} />
        )}
        {signedIn && tab === 'activity' && <ActivityScreen resident={resident} deposits={deposits} redemptions={redemptions} />}
        {signedIn && tab === 'profile' && <ProfileScreen resident={resident} settings={settings} onSettings={setSettings} onLogout={logout} />}
      </ScrollView>

      {signedIn && deposit.phase === 'waiting' && tab !== 'scan' ? (
        <Pressable onPress={() => setTab('scan')} style={s.depositBar}>
          <Banner>Deposit open — waiting for the machine. Tap to view.</Banner>
        </Pressable>
      ) : null}

      {signedIn ? (
        <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 3) }]}>
          {TABS.map(([id, label, icon]) => (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={s.tabButton}>
              <Text style={[s.tabIcon, tab === id && s.tabActive]}>{icon}</Text>
              <Text style={[s.tabLabel, tab === id && s.tabActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  center: { alignItems: 'center', justifyContent: 'center' },
  topbar: { height: 65, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' },
  brandSymbol: { color: C.paper, fontSize: 24, fontWeight: '700', lineHeight: 27 },
  brand: { color: C.forest, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  avatar: { width: 33, height: 33, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.forest, fontSize: 11, fontWeight: '900' },
  content: { width: '100%', maxWidth: 590, alignSelf: 'center', paddingHorizontal: 21, paddingTop: 24, paddingBottom: 36 },
  depositBar: { paddingHorizontal: 21, paddingTop: 10, backgroundColor: C.paper },
  tabbar: { minHeight: 65, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6 },
  tabIcon: { color: C.muted, fontSize: 23, lineHeight: 25 },
  tabLabel: { color: C.muted, fontSize: 10, fontWeight: '700' },
  tabActive: { color: C.forest, fontWeight: '900' },
});
