import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { alpha, C } from '../theme';
import { Button, Card, Hero, OutlinedButton, ServiceLayout } from '../components';
import { newIdempotencyKey } from '../api';
import RedemptionReceipt, { RedemptionDialog } from '../RedemptionReceipt';

export default function RewardsPosScreen({ wide, user, rewardItems, onRedeemItem, onBackToMenu }) {
  const [request, setRequest] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);

  const closeConfirmation = () => {
    if (!submitting.current) setRequest(null);
  };

  const confirmRedemption = async () => {
    if (submitting.current || !request) return;
    submitting.current = true;
    setSending(true);
    try {
      const result = await onRedeemItem(request.item, request.key, request.failed);
      if (result) {
        setRequest(null);
        setReceipt(result);
      } else {
        setRequest({ ...request, failed: true });
      }
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

  const summary = (
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
  );
  const actions = <OutlinedButton title="Back to menu" onPress={onBackToMenu} />;

  return (
    <ServiceLayout wide={wide} summary={summary} actions={actions}>
      <FlatList
        style={{ flex: 1 }}
        data={rewardItems}
        ListHeaderComponent={(
          <View>
            {!wide && summary}
            <Text accessibilityRole="header" style={[s.listTitle, wide && s.wideListTitle]}>Available rewards</Text>
          </View>
        )}
        persistentScrollbar
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 16, gap: 10 }}
        renderItem={({ item }) => {
          const canAfford = user.ecoPoints >= item.pointsCost;
          return (
            <Card radius={16} border={{ color: C.warmGray }} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
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
                  onPress={() => setRequest({ item, key: newIdempotencyKey(), failed: false })}
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
      {request ? (
        <RedemptionDialog title="Confirm redemption" onClose={closeConfirmation}>
          <Text style={s.confirmText}>Redeem {request.item.title} for {request.item.pointsCost} points?</Text>
          {request.failed ? (
            <Text accessibilityLiveRegion="polite" style={s.confirmText}>
              Couldn’t confirm this redemption. Try again or check your transaction history.
            </Text>
          ) : null}
          <Button
            title={sending ? 'Redeeming…' : request.failed ? 'Try again' : 'Confirm redemption'}
            onPress={confirmRedemption}
            disabled={sending}
            height={44}
          />
          {!sending ? <OutlinedButton title="Cancel" onPress={closeConfirmation} height={44} /> : null}
        </RedemptionDialog>
      ) : null}
      {receipt ? (
        <RedemptionReceipt redemption={receipt.redemption} balance={receipt.balance} onClose={() => setReceipt(null)} />
      ) : null}
    </ServiceLayout>
  );
}

const s = StyleSheet.create({
  top: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '900', color: C.white },
  sub: { fontSize: 12, color: alpha(C.white, 0.85) },
  balance: { borderRadius: 14, padding: 12, alignItems: 'flex-end', backgroundColor: alpha(C.white, 0.15) },
  balanceLabel: { fontSize: 9, color: alpha(C.white, 0.8), fontWeight: '700' },
  balanceValue: { fontSize: 20, fontWeight: '700', color: C.goldAmber },
  listTitle: { fontSize: 19, fontWeight: '900', color: C.darkPine, marginTop: 16, marginBottom: 10 },
  wideListTitle: { marginTop: 0, marginBottom: 0 },
  confirmText: { fontSize: 15, color: C.darkPine },
  itemTitle: { fontSize: 15, fontWeight: '700', color: C.darkPine },
  itemDesc: { fontSize: 11, color: C.textMuted },
  chip: { alignSelf: 'flex-start', backgroundColor: C.iceMint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  chipText: { fontSize: 9, fontWeight: '700', color: C.darkPine },
});
