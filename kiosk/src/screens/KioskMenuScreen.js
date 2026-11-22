import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { AppMode } from '../controller';
import { Card, Hero } from '../components';
import { formatKg } from '../format';

const OPTIONS = [
  { title: 'Deposit recyclables', description: 'Choose a material and earn Eco-Points.', icon: '♻', mode: AppMode.DEPOSIT },
  { title: 'Redeem rewards', description: 'Use your points for available rewards.', icon: '★', mode: AppMode.REWARDS_POS },
  { title: 'Point conversion', description: 'See how many points each material earns.', icon: '≈', mode: AppMode.POINT_CONVERSION },
  { title: 'Card & account', description: 'View activity or change your PIN.', icon: '▤', mode: AppMode.CARD_INQUIRY },
];

export default function KioskMenuScreen({ user, onNavigate }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text accessibilityRole="header" style={s.name}>Good to see you, {user.fullName.split(' ')[0]}.</Text>
      {user.barangay ? <Text style={s.copy}>{user.barangay}</Text> : null}

      <Hero style={s.summary}>
        <Text style={s.balanceLabel}>Your reward balance</Text>
        <Text style={s.points}>{user.ecoPoints} <Text style={s.unit}>points</Text></Text>
        <Text style={s.recycled}>{formatKg(user.totalWasteKg)} kg recycled</Text>
      </Hero>

      <Text accessibilityRole="header" style={s.section}>Kiosk services</Text>

      <View style={s.options}>
        {OPTIONS.map((option) => (
          <Card key={option.mode} onPress={() => onNavigate(option.mode)} style={s.option}>
            <View style={s.iconTile}><Text style={s.icon}>{option.icon}</Text></View>
            <View style={s.optionText}>
              <Text style={s.optionTitle}>{option.title}</Text>
              <Text style={s.copy}>{option.description}</Text>
            </View>
            <Text style={s.arrow}>→</Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, width: '100%', maxWidth: 680, alignSelf: 'center' },
  name: { fontSize: 32, fontWeight: '900', letterSpacing: -1, color: C.darkPine },
  copy: { fontSize: 13, lineHeight: 18, color: C.textMuted },
  summary: { marginTop: 16, paddingVertical: 22 },
  balanceLabel: { color: C.iceMint, fontSize: 13, fontWeight: '800' },
  points: { color: C.white, fontSize: 52, fontWeight: '900', letterSpacing: -1.5 },
  unit: { color: C.iceMint, fontSize: 17, fontWeight: '800', letterSpacing: 0 },
  recycled: { color: C.iceMint, fontSize: 14 },
  section: { fontSize: 22, fontWeight: '900', color: C.darkPine, marginTop: 24, marginBottom: 10 },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12 },
  iconTile: { width: 48, height: 48, borderRadius: 15, backgroundColor: C.iceMint, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 23, color: C.darkPine },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '800', color: C.darkPine },
  arrow: { fontSize: 22, color: C.darkPine },
});
