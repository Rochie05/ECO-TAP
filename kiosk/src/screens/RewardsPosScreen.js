import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { alpha, C } from '../theme';
import { Button, Card, Hero, OutlinedButton } from '../components';

const ICONS = { rice: '🌾', food: '🥫', oil: '🍾', hygiene: '🧴', bag: '🛍️', gift: '🎁' };

export default function RewardsPosScreen({ user, rewardItems, onRedeemItem, onBackToMenu }) {
  return (
    <View style={s.screen}>
      <Hero style={s.top}>
        <View style={{ flex: 1 }}>

          <Text accessibilityRole="header" style={s.title}>Rewards</Text>
          <Text style={s.sub}>{user.fullName}</Text>
        </View>
        <View style={s.balance}>
          <Text style={s.balanceLabel}>BALANCE</Text>
          <Text style={s.balanceValue}>{user.ecoPoints} PTS</Text>
        </View>
      </Hero>

      <Text accessibilityRole="header" style={s.listTitle}>Available rewards</Text>

      <FlatList
        style={{ flex: 1 }}
        data={rewardItems}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 16, gap: 10 }}
        renderItem={({ item }) => {
          const canAfford = user.ecoPoints >= item.pointsCost;
          return (
            <Card radius={16} border={{ color: C.warmGray }} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.icon}><Text style={{ fontSize: 24 }}>{ICONS[item.iconName] ?? '🎟️'}</Text></View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.itemTitle}>{item.title}</Text>
                {item.description ? <Text style={s.itemDesc}>{item.description}</Text> : null}
                {item.category ? (
                  <View style={s.chip}><Text style={s.chipText}>{item.category.toUpperCase()}</Text></View>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: canAfford ? C.darkPine : C.textMuted }}>{item.pointsCost} PTS</Text>
                <Button
                  title={canAfford ? 'Redeem' : 'More points needed'}
                  disabled={!canAfford}
                  onPress={() => onRedeemItem(item)}
                  radius={10}
                  height={44}
                  fontSize={11}
                  style={{ marginTop: 6 }}
                />
              </View>
            </Card>
          );
        }}
      />

      <OutlinedButton title="← Back to menu" onPress={onBackToMenu} style={{ marginTop: 8 }} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surfaceBg, padding: 20 },
  top: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '900', color: C.white },
  sub: { fontSize: 12, color: alpha(C.white, 0.85) },
  balance: { borderRadius: 14, padding: 12, alignItems: 'flex-end', backgroundColor: alpha(C.white, 0.15) },
  balanceLabel: { fontSize: 9, color: alpha(C.white, 0.8), fontWeight: '700' },
  balanceValue: { fontSize: 20, fontWeight: '700', color: C.goldAmber },
  listTitle: { fontSize: 19, fontWeight: '900', color: C.darkPine, marginTop: 16, marginBottom: 10 },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: C.iceMint, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: C.darkPine },
  itemDesc: { fontSize: 11, color: C.textMuted },
  chip: { alignSelf: 'flex-start', backgroundColor: C.iceMint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  chipText: { fontSize: 9, fontWeight: '700', color: C.darkPine },
});
