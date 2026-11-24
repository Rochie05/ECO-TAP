import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { alpha, C } from '../theme';
import { Button, Card, HeaderCard, ServiceLayout } from '../components';
import { kgWorth } from '../format';

/** View Reward Point Conversion: points earned per kg, and how much waste each reward is worth. */
export default function PointConversionScreen({ wide, user, categories, rewardItems, onBackToMenu }) {
  const summary = <HeaderCard eyebrow="REWARD POINT CONVERSION" title="How points work" subtitle={`Your balance: ${user.ecoPoints} pts`} />;
  const actions = <Button title="Back to menu" onPress={onBackToMenu} radius={20} height={40} />;
  return (
    <ServiceLayout wide={wide} summary={summary} actions={actions}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }} persistentScrollbar>
        {!wide && summary}
        <Text style={s.section}>POINTS YOU EARN</Text>
        {categories.length === 0 ? <Text style={s.empty}>No waste categories available.</Text> : null}
        {categories.map((item) => (
          <InfoCard key={item.id}>
            <View style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{item.name}</Text>
                <Text style={s.itemSub}>1 kg = {item.pointsPerKg} pts · 5 kg = {item.pointsPerKg * 5} pts</Text>
              </View>
              <Text style={s.rate}>{item.pointsPerKg} pts/kg</Text>
            </View>
          </InfoCard>
        ))}

        <Text style={s.section}>WHAT POINTS GET YOU</Text>
        {rewardItems.length === 0 ? <Text style={s.empty}>No rewards listed yet.</Text> : null}
        {rewardItems.map((reward) => (
          <InfoCard key={reward.id}>
            <Text style={s.itemTitle}>{reward.title}</Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: C.darkPine }}>{reward.pointsCost} pts</Text>
            {categories.length > 0 ? (
              <Text style={s.itemSub}>
                Equal to about {categories.map((c) => `${kgWorth(reward.pointsCost, c.pointsPerKg)} kg ${c.name}`).join(' or ')}
              </Text>
            ) : null}
          </InfoCard>
        ))}
      </ScrollView>

    </ServiceLayout>
  );
}

function InfoCard({ children }) {
  return (
    <Card radius={14} color={C.iceMint} border={{ color: C.warmGray }} style={{ padding: 14, gap: 2 }}>
      {children}
    </Card>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 11, fontWeight: '700', color: C.darkPine, letterSpacing: 0.8 },
  empty: { fontSize: 13, color: C.darkPine },
  itemTitle: { fontSize: 15, fontWeight: '700', color: C.darkPine },
  itemSub: { fontSize: 12, color: alpha(C.darkPine, 0.75) },
  rate: { fontSize: 15, fontWeight: '700', color: C.darkPine },
});
