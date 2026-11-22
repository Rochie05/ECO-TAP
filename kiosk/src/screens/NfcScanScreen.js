import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Hero } from '../components';

export default function NfcScanScreen() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text accessibilityRole="header" style={s.title}>Tap your Eco-Card</Text>
      <Text style={s.intro}>Sign in to deposit recyclables, check your points, or redeem rewards.</Text>

      <Hero style={s.reader}>
        <View accessible={false} style={s.cardArt}>
          <View style={s.chip} />
          <Text style={s.contactless}>)))</Text>
          <Text style={s.cardBrand}>ECO-TAP</Text>
        </View>
        <View style={s.status}>
          <View style={s.dot} />
          <Text style={s.statusText}>Waiting for a card</Text>
        </View>
      </Hero>

      <Text style={s.hint}>Hold your card flat against the back of this device until it is detected.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 30, width: '100%', maxWidth: 580, alignSelf: 'center' },
  title: { fontSize: 38, fontWeight: '900', color: C.darkPine, letterSpacing: -1.5 },
  intro: { fontSize: 15, lineHeight: 22, color: C.textMuted, marginTop: 6, marginBottom: 22 },
  reader: { minHeight: 244, alignItems: 'center', justifyContent: 'center', gap: 24 },
  cardArt: {
    width: 154, height: 98, borderRadius: 16, backgroundColor: C.iceMint, borderWidth: 1,
    borderColor: C.leaf, padding: 15, justifyContent: 'space-between', transform: [{ rotate: '-8deg' }],
  },
  chip: { width: 26, height: 19, backgroundColor: C.goldAmber, borderRadius: 5 },
  contactless: { position: 'absolute', right: 15, top: 13, color: C.darkPine, fontWeight: '900' },
  cardBrand: { color: C.darkPine, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.leaf },
  statusText: { color: C.iceMint, fontSize: 14, fontWeight: '700' },
  hint: { color: C.textMuted, fontSize: 14, lineHeight: 21, marginTop: 16 },
});
