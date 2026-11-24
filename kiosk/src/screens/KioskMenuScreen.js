import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { KIOSK_LOCATION } from '../config';
import { AppMode } from '../controller';
import { Card, Hero } from '../components';
import { formatKg } from '../format';

const OPTIONS = [
  { title: 'Deposit recyclables', description: 'Choose a material and earn Eco-Points.', mode: AppMode.DEPOSIT },
  { title: 'Redeem rewards', description: 'Use your points for available rewards.', mode: AppMode.REWARDS_POS },
  { title: 'Point conversion', description: 'See how many points each material earns.', mode: AppMode.POINT_CONVERSION },
  { title: 'Card & account', description: 'View activity or change your PIN.', mode: AppMode.CARD_INQUIRY },
];

export default function KioskMenuScreen({ wide, user, onNavigate }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, wide && s.wideContent]}>
      <View style={wide && s.overview}>
        <Text accessibilityRole="header" style={s.name}>Good to see you, {user.fullName.split(' ')[0]}.</Text>
        <Text style={s.copy}>{KIOSK_LOCATION}</Text>

        <Hero style={s.summary}>
          <Text style={s.balanceLabel}>Your reward balance</Text>
          <Text style={s.points}>{user.ecoPoints} <Text style={s.unit}>points</Text></Text>
          <Text style={s.recycled}>{formatKg(user.totalWasteKg)} kg recycled</Text>
        </Hero>
      </View>

      <View style={wide && s.services}>
        <Text accessibilityRole="header" style={[s.section, wide && s.wideSection]}>Kiosk services</Text>
        <View style={[s.options, wide && s.wideOptions]}>
          {OPTIONS.map((option) => (
            <Card key={option.mode} onPress={() => onNavigate(option.mode)} style={[s.option, wide && s.wideOption]}>
              <View style={s.optionText}>
                <Text style={s.optionTitle}>{option.title}</Text>
                <Text style={s.copy}>{option.description}</Text>
              </View>
              <View accessible={false} style={s.arrow} />
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, width: '100%', maxWidth: 680, alignSelf: 'center' },
  wideContent: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 24, maxWidth: 1120, paddingVertical: 12 },
  overview: { flex: 1, minWidth: 0 },
  services: { flex: 1.35, minWidth: 0 },
  name: { fontSize: 32, fontWeight: '900', letterSpacing: -1, color: C.darkPine },
  copy: { fontSize: 13, lineHeight: 18, color: C.textMuted },
  summary: { marginTop: 16, paddingVertical: 22 },
  balanceLabel: { color: C.iceMint, fontSize: 13, fontWeight: '800' },
  points: { color: C.white, fontSize: 52, fontWeight: '900', letterSpacing: -1.5 },
  unit: { color: C.iceMint, fontSize: 17, fontWeight: '800', letterSpacing: 0 },
  recycled: { color: C.iceMint, fontSize: 14 },
  section: { fontSize: 22, fontWeight: '900', color: C.darkPine, marginTop: 24, marginBottom: 10 },
  wideSection: { marginTop: 0, marginBottom: 6 },
  options: { gap: 10 },
  wideOptions: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12 },
  wideOption: { padding: 7, gap: 9 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '800', color: C.darkPine },
  arrow: { width: 7, height: 7, marginRight: 4, borderTopWidth: 2, borderRightWidth: 2, borderColor: C.darkPine, transform: [{ rotate: '45deg' }] },
});
