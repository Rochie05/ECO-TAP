import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, BackHandler, Image, KeyboardAvoidingView, Pressable, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, hasToken, setToken, setUnauthorizedHandler } from './src/api';
import { NotificationsButton, NotificationsDialog } from './src/Notifications';
import { C } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const TABS = [
  ['home', 'Home', '⌂'], ['rewards', 'Rewards', '◇'],
  ['activity', 'Activity', '≡'], ['profile', 'Profile', '◯'],
];

export default function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}

function Root() {
  const insets = useSafeAreaInsets();
  const [resident, setResident] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [tab, setTab] = useState('home');
  const [authNotice, setAuthNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [seenNotification, setSeenNotification] = useState(null);
  const session = useRef(0);
  const latestMaterialUpdate = useRef(null);

  // Shared lists. null = still loading, [] = loaded but empty.
  const [stations, setStations] = useState(null);
  const [stationsError, setStationsError] = useState('');
  const [rewards, setRewards] = useState(null);
  const [rewardsError, setRewardsError] = useState('');

  const loadAccount = useCallback(async () => {
    const current = session.current;
    const data = await api.me();
    if (current !== session.current || !hasToken()) return;
    setResident(data.resident);
    setDeposits(data.deposits);
    setRedemptions(data.redemptions);
  }, []);

  const loadLists = useCallback(() => {
    api.stations().then((v) => { setStations(v); setStationsError(''); }).catch((e) => setStationsError(e.message));
    api.rewards().then((v) => { setRewards(v); setRewardsError(''); }).catch((e) => setRewardsError(e.message));
  }, []);

  const loadNotifications = useCallback(async () => {
    const current = session.current;
    try {
      const items = await api.notifications();
      if (current !== session.current || !hasToken()) return;
      setNotifications(items);
      setNotificationsError('');
      const materialUpdate = items.find((item) => item.kind === 'deposit' || item.batchId);
      if (materialUpdate && materialUpdate.id !== latestMaterialUpdate.current) {
        latestMaterialUpdate.current = materialUpdate.id;
        loadAccount().catch(() => {});
      }
    } catch (error) {
      if (current === session.current && hasToken()) {
        setNotificationsError(error.status === 404
          ? 'Notifications are unavailable until the server update is deployed.'
          : error.message);
      }
    }
  }, [loadAccount]);

  const clearSession = useCallback((message = '') => {
    session.current += 1;
    latestMaterialUpdate.current = null;
    setToken(null);
    setResident(null); setDeposits([]); setRedemptions([]);
    setTab('home');
    setNotifications([]);
    setNotificationsOpen(false);
    setNotificationsError('');
    setSeenNotification(null);
    setAuthNotice(message);
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    clearSession('');
  }, [clearSession]);

  // The server drops a resident session after 15 minutes without activity.
  useEffect(() => { setUnauthorizedHandler((message) => clearSession(message || 'Your session ended. Please sign in again.')); }, [clearSession]);

  const onAuthenticated = useCallback((signedIn) => {
    setAuthNotice('');
    setResident(signedIn);
    setStations(null); setRewards(null);
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

  const signedIn = Boolean(resident);
  useEffect(() => {
    if (!signedIn) return;
    loadNotifications();
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') loadNotifications();
    }, 30000);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadNotifications();
    });
    return () => { clearInterval(poll); foreground.remove(); };
  }, [signedIn, loadNotifications]);

  useEffect(() => {
    if (notificationsOpen && notifications.length) setSeenNotification(notifications[0].id);
  }, [notificationsOpen, notifications]);

  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top }]} behavior="padding">
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
      <View style={s.topbar}>
        <View style={s.brandRow}><Image source={require('./assets/eco-tap-logo.png')} style={s.brandMark} resizeMode="contain" /><Text style={s.brand}>ECO-TAP</Text></View>
        {signedIn ? (
          <View style={s.topActions}>
            <NotificationsButton unread={Boolean(notifications[0] && notifications[0].id !== seenNotification)}
              onPress={() => { setNotificationsOpen(true); loadNotifications(); }} />
            <Pressable onPress={() => setTab('profile')} accessibilityRole="button" accessibilityLabel="Profile" style={s.avatar}>
              <Text style={s.avatarText}>{resident.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, !signedIn && { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.forest} colors={[C.forest]} /> : undefined}>
        {!signedIn && (
          <AuthScreen onAuthenticated={onAuthenticated} notice={authNotice} />
        )}
        {signedIn && tab === 'home' && (
          <HomeScreen resident={resident} deposits={deposits} stations={stations} stationsError={stationsError} goTo={setTab} />
        )}
        {signedIn && tab === 'rewards' && (
          <RewardsScreen resident={resident} rewards={rewards} rewardsError={rewardsError} reload={loadLists}
            onRedeemed={(updated) => { setResident(updated); loadAccount().catch(() => {}); }} />
        )}
        {signedIn && tab === 'activity' && <ActivityScreen resident={resident} deposits={deposits} redemptions={redemptions} />}
        {signedIn && tab === 'profile' && <ProfileScreen resident={resident} onLogout={logout} />}
      </ScrollView>

      {signedIn && notificationsOpen ? (
        <NotificationsDialog items={notifications} error={notificationsError} onRefresh={loadNotifications}
          onClose={() => setNotificationsOpen(false)} />
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
  topbar: { height: 65, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 42, height: 42 },
  brand: { color: C.forest, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  avatar: { width: 33, height: 33, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.forest, fontSize: 11, fontWeight: '900' },
  content: { width: '100%', maxWidth: 590, alignSelf: 'center', paddingHorizontal: 21, paddingTop: 24, paddingBottom: 36 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabbar: { minHeight: 65, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6 },
  tabIcon: { color: C.muted, fontSize: 23, lineHeight: 25 },
  tabLabel: { color: C.muted, fontSize: 10, fontWeight: '700' },
  tabActive: { color: C.forest, fontWeight: '900' },
});
