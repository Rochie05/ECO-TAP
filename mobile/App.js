import React, { useState } from 'react';
import {
  Alert, Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

const C = {
  forest: '#174B35', leaf: '#65A66F', paper: '#F4F5EB', white: '#FFFFFF',
  muted: '#63786A', line: '#D8E2D5', soft: '#E7F0E4', pale: '#F8FAF4', amber: '#E9AE59',
};
const INITIAL = {
  points: 150,
  deposits: [
    { id: 'seed-1', type: 'PET bottles', station: 'K-001', weight: 1.2, points: 12, date: 'Nov 4', kind: 'deposit' },
    { id: 'seed-2', type: 'HDPE containers', station: 'K-002', weight: 0.8, points: 16, date: 'Nov 3', kind: 'deposit' },
  ],
  redemptions: [],
};
const STATIONS = [
  { id: 'K-001', name: 'QC Hall · High Rise Lobby', status: 'Ready', fill: 62 },
  { id: 'K-002', name: 'QC Hall · Annex Entrance', status: 'Ready', fill: 43 },
  { id: 'K-003', name: 'QC Hall · Parking Area', status: 'Almost full', fill: 91 },
];
const REWARDS = [
  { id: 'seedling', icon: '✿', name: 'Community seedling', detail: 'Grow a greener neighborhood', cost: 80 },
  { id: 'tote', icon: '▧', name: 'Reusable tote', detail: 'Carry less single-use plastic', cost: 120 },
  { id: 'kit', icon: '◇', name: 'Eco starter kit', detail: 'Everyday low-waste essentials', cost: 200 },
];
const TABS = [
  ['home', 'Home', '⌂'], ['scan', 'Deposit', '◎'], ['rewards', 'Rewards', '◇'],
  ['activity', 'Activity', '≡'], ['profile', 'Profile', '◯'],
];

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Button({ children, onPress, kind = 'primary', disabled = false, style }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, kind === 'outline' && styles.buttonOutline,
      kind === 'light' && styles.buttonLight, disabled && styles.disabled,
      pressed && !disabled && styles.pressed, style]}>
    <Text style={[styles.buttonText, kind === 'outline' && styles.buttonOutlineText,
      kind === 'light' && styles.buttonLightText]}>{children}</Text>
  </Pressable>;
}

function SectionTitle({ eyebrow, title, action, onAction }) {
  return <View style={styles.sectionHead}>
    <View style={{ flex: 1 }}>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {action && <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.textLink}>{action} →</Text></Pressable>}
  </View>;
}

function Meter({ value }) {
  return <View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} /></View>;
}

function StationCard({ station, compact = false }) {
  return <View style={[styles.station, compact && styles.stationCompact]}>
    <View style={styles.stationIcon}><Text style={styles.stationIconText}>♻</Text></View>
    <View style={{ flex: 1 }}>
      <View style={styles.rowBetween}><Text style={styles.stationId}>{station.id}</Text><Text style={[styles.status, station.fill > 85 && styles.statusWarm]}>{station.status}</Text></View>
      <Text style={styles.stationName}>{station.name}</Text>
      <Meter value={station.fill} />
      <Text style={styles.stationMeta}>{station.fill}% capacity</Text>
    </View>
  </View>;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [data, setData] = useState(INITIAL);
  const [material, setMaterial] = useState('PET');
  const [weight, setWeight] = useState('1.0');
  const [station, setStation] = useState('K-001');
  const [notice, setNotice] = useState('');

  const totalWeight = data.deposits.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const estimatedPoints = Math.round((Number(weight) || 0) * (material === 'PET' ? 10 : 20));

  function recordDeposit() {
    const amount = Number(weight);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 20) {
      Alert.alert('Check the weight', 'Enter a weight between 0.1 and 20 kg.');
      return;
    }
    const earned = Math.round(amount * (material === 'PET' ? 10 : 20));
    const entry = {
      id: String(Date.now()), kind: 'deposit', station, weight: amount, points: earned,
      type: material === 'PET' ? 'PET bottles' : 'HDPE containers',
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
    setData((current) => ({ ...current, points: current.points + earned, deposits: [entry, ...current.deposits] }));
    setNotice(`Demo deposit recorded · +${earned} points`);
    setTab('activity');
  }

  function redeem(reward) {
    if (data.points < reward.cost) return;
    Alert.alert('Redeem demo reward?', `${reward.name} costs ${reward.cost} points.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Redeem', onPress: () => {
        setData((current) => ({ ...current, points: current.points - reward.cost,
          redemptions: [{ id: String(Date.now()), name: reward.name, cost: reward.cost,
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }, ...current.redemptions] }));
        setNotice(`${reward.name} redeemed in demo mode`);
        setTab('activity');
      } },
    ]);
  }

  function resetDemo() {
    Alert.alert('Reset demo data?', 'This restores the sample points and activity on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', onPress: () => { setData(INITIAL); setNotice('Demo data reset'); setTab('home'); } },
    ]);
  }

  return <SafeAreaView style={[styles.root, Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight || 0 }]}>
    <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
    <View style={styles.topbar}>
      <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandSymbol}>↻</Text></View><Text style={styles.brand}>ECO-TAP</Text></View>
      <View style={styles.avatar}><Text style={styles.avatarText}>JD</Text></View>
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {notice && <Pressable onPress={() => setNotice('')} style={styles.notice}><Text style={styles.noticeText}>{notice}</Text><Text style={styles.noticeText}>×</Text></Pressable>}

      {tab === 'home' && <>
        <Text style={styles.eyebrow}>SMALL ACTIONS, GREENER COMMUNITIES</Text>
        <Text style={styles.pageTitle}>Good to see you, <Text style={styles.accent}>Juan.</Text></Text>
        <Text style={styles.intro}>Your recycling journey is adding up. Keep going, one deposit at a time.</Text>
        <View style={styles.heroCard}>
          <View style={styles.heroDecoration} /><Text style={styles.heroLabel}>YOUR REWARD BALANCE</Text>
          <View style={styles.pointsLine}><Text style={styles.points}>{data.points}</Text><Text style={styles.pointsUnit}>points</Text></View>
          <Text style={styles.heroCopy}>Turn plastic into something positive.</Text>
          <Button kind="light" onPress={() => setTab('rewards')} style={{ alignSelf: 'flex-start', marginTop: 22 }}>Explore rewards  →</Button>
        </View>
        <View style={styles.statGrid}>
          <Card style={styles.statCard}><Text style={styles.statIcon}>♻</Text><Text style={styles.statValue}>{totalWeight.toFixed(1)} kg</Text><Text style={styles.statLabel}>Plastic collected</Text></Card>
          <Card style={styles.statCard}><Text style={styles.statIcon}>◎</Text><Text style={styles.statValue}>{data.deposits.length}</Text><Text style={styles.statLabel}>Total deposits</Text></Card>
        </View>
        <SectionTitle eyebrow="GET STARTED" title="Make your next deposit" />
        <Card style={styles.actionCard}><View style={styles.actionArt}><Text style={styles.actionArtText}>♻</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Recycle & earn</Text><Text style={styles.cardCopy}>Log a PET or HDPE deposit and see your points grow.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Log a deposit" onPress={() => setTab('scan')} style={styles.arrowButton}><Text style={styles.arrowText}>→</Text></Pressable></Card>
        <SectionTitle eyebrow="COLLECTION NETWORK" title="Nearby kiosks" action="See all" onAction={() => setTab('scan')} />
        <StationCard compact station={STATIONS[0]} />
      </>}

      {tab === 'scan' && <>
        <Text style={styles.eyebrow}>RECYCLE & EARN</Text><Text style={styles.pageTitle}>Log a <Text style={styles.accent}>deposit.</Text></Text>
        <Text style={styles.intro}>Choose a kiosk and material to preview the points you could earn.</Text>
        <Card style={styles.demoBanner}><Text style={styles.demoBannerTitle}>Demo deposit</Text><Text style={styles.demoBannerCopy}>This app records a sample entry on your device. It does not scan an NFC tag or confirm a physical deposit.</Text></Card>
        <SectionTitle eyebrow="STEP 01" title="Choose a kiosk" />
        <View style={styles.choiceList}>{STATIONS.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected: station === item.id }} onPress={() => setStation(item.id)} style={[styles.choiceCard, station === item.id && styles.choiceSelected]}><View style={[styles.radio, station === item.id && styles.radioSelected]} /><View style={{ flex: 1 }}><Text style={styles.choiceTitle}>{item.id}</Text><Text style={styles.choiceDetail}>{item.name}</Text></View><Text style={styles.choiceStatus}>{item.status}</Text></Pressable>)}</View>
        <SectionTitle eyebrow="STEP 02" title="Material & weight" />
        <View style={styles.segment}>{[['PET', 'PET bottles'], ['HDPE', 'HDPE containers']].map(([id, label]) => <Pressable key={id} onPress={() => setMaterial(id)} style={[styles.segmentButton, material === id && styles.segmentSelected]}><Text style={[styles.segmentText, material === id && styles.segmentTextSelected]}>{label}</Text></Pressable>)}</View>
        <Text style={styles.fieldLabel}>Weight in kilograms</Text><TextInput accessibilityLabel="Weight in kilograms" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={styles.input} placeholder="1.0" placeholderTextColor={C.muted} />
        <View style={styles.presets}>{['0.5', '1.0', '2.0'].map((value) => <Pressable key={value} onPress={() => setWeight(value)} style={[styles.preset, weight === value && styles.presetSelected]}><Text style={styles.presetText}>{value} kg</Text></Pressable>)}</View>
        <View style={styles.estimate}><Text style={styles.estimateLabel}>Estimated points</Text><Text style={styles.estimateValue}>+{estimatedPoints}</Text></View>
        <Button onPress={recordDeposit} style={{ marginTop: 16 }}>Record demo deposit  →</Button>
      </>}

      {tab === 'rewards' && <>
        <Text style={styles.eyebrow}>GOOD DEEDS, GOOD REWARDS</Text><Text style={styles.pageTitle}>Your effort <Text style={styles.accent}>pays off.</Text></Text>
        <Text style={styles.intro}>Use your points for useful rewards that help you keep living green.</Text>
        <View style={styles.balanceCard}><Text style={styles.balanceLabel}>AVAILABLE POINTS</Text><Text style={styles.balancePoints}>{data.points}</Text><Text style={styles.balanceSub}>Every bottle makes a difference.</Text></View>
        <SectionTitle eyebrow="REWARD COLLECTION" title="Choose your reward" />
        {REWARDS.map((reward) => <Card key={reward.id} style={styles.rewardCard}><View style={styles.rewardIcon}><Text style={styles.rewardIconText}>{reward.icon}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{reward.name}</Text><Text style={styles.cardCopy}>{reward.detail}</Text><Text style={styles.rewardCost}>{reward.cost} points</Text></View><Button kind="outline" disabled={data.points < reward.cost} onPress={() => redeem(reward)} style={styles.redeemButton}>Redeem</Button></Card>)}
        <Text style={styles.footnote}>Rewards are sample items. This demo does not issue or fulfill real rewards.</Text>
      </>}

      {tab === 'activity' && <>
        <Text style={styles.eyebrow}>YOUR RECYCLING STORY</Text><Text style={styles.pageTitle}>Every step <Text style={styles.accent}>counts.</Text></Text>
        <Text style={styles.intro}>See your sample deposits and reward redemptions in one place.</Text>
        <View style={styles.statGrid}><Card style={styles.statCard}><Text style={styles.statValue}>{data.deposits.length}</Text><Text style={styles.statLabel}>Deposits logged</Text></Card><Card style={styles.statCard}><Text style={styles.statValue}>{totalWeight.toFixed(1)} kg</Text><Text style={styles.statLabel}>Plastic collected</Text></Card></View>
        <SectionTitle eyebrow="RECENT ACTIVITY" title="History" />
        {[
          ...data.deposits.map((item) => ({ ...item, sort: Number(item.id.replace('seed-', '0')) || 0 })),
          ...data.redemptions.map((item) => ({ ...item, kind: 'reward', sort: Number(item.id) || 0 })),
        ].sort((a, b) => b.sort - a.sort).map((item) => <Card key={item.id} style={styles.activityCard}><View style={[styles.activityIcon, item.kind === 'reward' && styles.activityRewardIcon]}><Text style={styles.activityIconText}>{item.kind === 'reward' ? '◇' : '♻'}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.kind === 'reward' ? item.name : item.type}</Text><Text style={styles.cardCopy}>{item.kind === 'reward' ? 'Reward redeemed' : `${item.station} · ${item.weight} kg`} · {item.date}</Text></View><Text style={[styles.activityPoints, item.kind === 'reward' && styles.activityDebit]}>{item.kind === 'reward' ? '−' : '+'}{item.kind === 'reward' ? item.cost : item.points}</Text></Card>)}
      </>}

      {tab === 'profile' && <>
        <Text style={styles.eyebrow}>YOUR ECO-TAP ACCOUNT</Text><Text style={styles.pageTitle}>Hello, <Text style={styles.accent}>Juan.</Text></Text>
        <Text style={styles.intro}>A small action today can make a bigger difference tomorrow.</Text>
        <Card style={styles.profileCard}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>JD</Text></View><View><Text style={styles.profileName}>Juan Dela Cruz</Text><Text style={styles.profileDetail}>Demo resident · R-10023</Text></View></Card>
        <SectionTitle eyebrow="HOW IT WORKS" title="Recycling made simple" />
        {[['01', 'Sort your plastic', 'Separate PET bottles and HDPE containers.'], ['02', 'Visit a kiosk', 'Bring materials to an ECO-TAP collection point.'], ['03', 'Earn rewards', 'Collect points and redeem useful items.']].map(([number, title, copy]) => <Card key={number} style={styles.howCard}><View style={styles.stepNumber}><Text style={styles.stepText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardCopy}>{copy}</Text></View></Card>)}
        <Button kind="outline" onPress={resetDemo} style={{ marginTop: 8 }}>Reset demo data</Button>
        <Text style={styles.footnote}>This is a resident app prototype. Sample activity lasts for this app session and is not connected to a real account, kiosk, or reward service.</Text>
      </>}
    </ScrollView>

    <View style={styles.tabbar}>{TABS.map(([id, label, icon]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => { setTab(id); setNotice(''); }} style={styles.tabButton}><Text style={[styles.tabIcon, tab === id && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, tab === id && styles.tabActive]}>{label}</Text></Pressable>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper }, loading: { margin: 36, color: C.forest, fontSize: 28, fontWeight: '900' },
  topbar: { height: 65, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' }, brandSymbol: { color: C.paper, fontSize: 24, fontWeight: '700', lineHeight: 27 }, brand: { color: C.forest, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  avatar: { width: 33, height: 33, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.forest, fontSize: 11, fontWeight: '900' },
  scroll: { flex: 1 }, content: { width: '100%', maxWidth: 590, alignSelf: 'center', paddingHorizontal: 21, paddingTop: 24, paddingBottom: 36 },
  eyebrow: { color: C.leaf, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 9 }, pageTitle: { color: C.forest, fontSize: 38, lineHeight: 43, letterSpacing: -1.8, fontWeight: '900', maxWidth: 360 }, accent: { color: C.leaf }, intro: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 25 },
  notice: { backgroundColor: C.soft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }, noticeText: { color: C.forest, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: C.pale, borderColor: C.line, borderWidth: 1, borderRadius: 19, padding: 18, marginBottom: 12 },
  heroCard: { backgroundColor: C.forest, borderRadius: 25, minHeight: 226, padding: 25, overflow: 'hidden', marginBottom: 14 }, heroDecoration: { position: 'absolute', right: -42, top: -38, width: 205, height: 205, borderRadius: 105, borderWidth: 35, borderColor: '#296445' }, heroLabel: { color: '#BBD7BD', fontSize: 10, letterSpacing: 1.5, fontWeight: '900' }, pointsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }, points: { color: C.paper, fontSize: 61, fontWeight: '900', letterSpacing: -3, lineHeight: 67 }, pointsUnit: { color: C.leaf, fontSize: 18, fontWeight: '800' }, heroCopy: { color: '#E1ECE0', fontSize: 13 },
  button: { minHeight: 44, borderRadius: 30, backgroundColor: C.forest, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: C.paper, fontSize: 13, fontWeight: '800' }, buttonLight: { backgroundColor: C.paper }, buttonLightText: { color: C.forest }, buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.forest }, buttonOutlineText: { color: C.forest }, disabled: { opacity: 0.35 }, pressed: { opacity: 0.8 },
  statGrid: { flexDirection: 'row', gap: 11, marginBottom: 20 }, statCard: { flex: 1, minHeight: 112, marginBottom: 0 }, statIcon: { color: C.leaf, fontSize: 21, marginBottom: 7 }, statValue: { color: C.forest, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 }, statLabel: { color: C.muted, fontSize: 11, marginTop: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 9, marginBottom: 13, gap: 10 }, sectionTitle: { color: C.forest, fontSize: 22, fontWeight: '900', letterSpacing: -0.7 }, textLink: { color: C.forest, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 13 }, actionArt: { width: 55, height: 55, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, actionArtText: { color: C.forest, fontSize: 29 }, cardTitle: { color: C.forest, fontSize: 14, fontWeight: '800', lineHeight: 19 }, cardCopy: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }, arrowButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: C.paper, fontSize: 19 },
  station: { backgroundColor: C.pale, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', gap: 12, marginBottom: 11 }, stationCompact: { marginBottom: 0 }, stationIcon: { width: 38, height: 38, backgroundColor: C.soft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, stationIconText: { color: C.forest, fontSize: 23 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, stationId: { color: C.forest, fontSize: 13, fontWeight: '900' }, stationName: { color: C.muted, fontSize: 11, marginTop: 3, marginBottom: 9 }, stationMeta: { color: C.muted, fontSize: 10, marginTop: 5 }, status: { color: C.forest, backgroundColor: C.soft, fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }, statusWarm: { backgroundColor: '#FFF0D9' }, meter: { height: 7, borderRadius: 7, backgroundColor: C.soft, overflow: 'hidden' }, meterFill: { height: '100%', backgroundColor: C.leaf, borderRadius: 7 },
  demoBanner: { backgroundColor: C.soft }, demoBannerTitle: { color: C.forest, fontWeight: '800', fontSize: 13 }, demoBannerCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  choiceList: { gap: 9, marginBottom: 15 }, choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.pale, padding: 14 }, choiceSelected: { borderColor: C.forest, backgroundColor: C.soft }, radio: { width: 17, height: 17, borderWidth: 2, borderColor: C.muted, borderRadius: 9 }, radioSelected: { borderColor: C.forest, backgroundColor: C.leaf }, choiceTitle: { color: C.forest, fontWeight: '800', fontSize: 12 }, choiceDetail: { color: C.muted, fontSize: 10, marginTop: 3 }, choiceStatus: { color: C.forest, fontSize: 10, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 13, padding: 4, marginBottom: 20 }, segmentButton: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 10 }, segmentSelected: { backgroundColor: C.forest }, segmentText: { color: C.forest, fontWeight: '700', fontSize: 11 }, segmentTextSelected: { color: C.paper }, fieldLabel: { color: C.forest, fontSize: 12, fontWeight: '800', marginBottom: 8 }, input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.pale, borderRadius: 13, minHeight: 48, paddingHorizontal: 14, color: C.forest, fontSize: 16 }, presets: { flexDirection: 'row', gap: 8, marginTop: 10 }, preset: { borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 13 }, presetSelected: { borderColor: C.forest, backgroundColor: C.soft }, presetText: { color: C.forest, fontWeight: '700', fontSize: 11 }, estimate: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }, estimateLabel: { color: C.muted, fontSize: 13 }, estimateValue: { color: C.forest, fontWeight: '900', fontSize: 28 },
  balanceCard: { borderRadius: 22, backgroundColor: C.forest, padding: 22, marginBottom: 17 }, balanceLabel: { color: C.leaf, fontWeight: '900', letterSpacing: 1.3, fontSize: 10 }, balancePoints: { color: C.paper, fontSize: 54, fontWeight: '900', marginTop: 5 }, balanceSub: { color: '#D6E6D6', fontSize: 12 }, rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }, rewardIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, rewardIconText: { color: C.forest, fontSize: 25 }, rewardCost: { color: C.forest, fontWeight: '900', fontSize: 11, marginTop: 10 }, redeemButton: { minHeight: 35, paddingHorizontal: 10 }, footnote: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 15, marginBottom: 8 },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }, activityIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, activityRewardIcon: { backgroundColor: '#F9EED9' }, activityIconText: { color: C.forest, fontSize: 23 }, activityPoints: { color: C.leaf, fontSize: 15, fontWeight: '900' }, activityDebit: { color: C.forest },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 19 }, profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' }, profileAvatarText: { color: C.paper, fontWeight: '900', fontSize: 15 }, profileName: { color: C.forest, fontSize: 17, fontWeight: '900' }, profileDetail: { color: C.muted, fontSize: 11, marginTop: 4 }, howCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13 }, stepNumber: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, stepText: { color: C.forest, fontWeight: '900', fontSize: 12 },
  tabbar: { minHeight: 65, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper, paddingBottom: Platform.OS === 'ios' ? 10 : 3 }, tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, tabIcon: { color: C.muted, fontSize: 23, lineHeight: 25 }, tabLabel: { color: C.muted, fontSize: 10, fontWeight: '700' }, tabActive: { color: C.forest, fontWeight: '900' },
});
