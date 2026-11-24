import React, { useEffect, useState } from 'react';
import { BackHandler, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { alpha, C } from '../theme';
import { KIOSK_LOCATION } from '../config';
import RedemptionReceipt, { DepositReceipt } from '../RedemptionReceipt';
import { Button, Card, OutlinedButton, ServiceLayout } from '../components';
import { formatDate, formatKg } from '../format';

// Compose gradient colors, flattened to the first stop (no gradient dependency).
const CARD_GREEN = C.darkPine;

export default function CardInquiryScreen({ wide, user, deposits, redemptions, onUpdatePin, onBackToMenu }) {
  const [showPin, setShowPin] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState(null);

  useEffect(() => {
    if (!showTransactions) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowTransactions(false);
      return true;
    });
    return () => subscription.remove();
  }, [showTransactions]);

  const rows = [
    ...deposits.filter((d) => d.userId === user.id).map((d) => ({ kind: 'deposit', key: `d-${d.id}`, item: d })),
    ...redemptions.filter((r) => r.userId === user.id).map((r) => ({ kind: 'redeem', key: `r-${r.id}`, item: r })),
  ];

  const savePin = async () => {
    if (newPin.length !== 6) { setPinMessage('PIN must be 6 digits.'); return; }
    const ok = await onUpdatePin(newPin);
    if (ok) { setPinMessage('PIN Updated Successfully!'); setShowPin(false); setNewPin(''); }
    else setPinMessage('Could not update PIN. Please try again.');
  };

  const changePin = <Button title="Change PIN" onPress={() => setShowPin(!showPin)} color={C.goldAmber} textColor={C.black} radius={12} height={wide ? 40 : 32} fontSize={11} />;
  const summary = (
    <Card radius={22} color={CARD_GREEN} elevation={6} style={{ padding: 20 }}>
      <View style={s.between}>
        <Text style={s.cardBrand}>QUEZON CITY ECO-CARD</Text>
        {!wide && changePin}
      </View>

      <View style={s.chip} />

      <Text style={s.name}>{user.fullName.toUpperCase()}</Text>
      <View style={wide ? s.cardDetails : s.between}>
        <Text style={s.uid}>UID: {user.nfcCardId}</Text>
        <Text style={s.barangay}>{KIOSK_LOCATION}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <View style={s.stat}>
          <Text style={s.statLabel}>ECO-POINTS BALANCE</Text>
          <Text style={[s.statValue, { color: C.goldAmber }]}>{user.ecoPoints} PTS</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>TOTAL WASTE RECYCLED</Text>
          <Text style={[s.statValue, { color: C.white }]}>{formatKg(user.totalWasteKg)} KG</Text>
        </View>
      </View>
    </Card>
  );

  const pinForm = showPin ? (
      <Card radius={16} color={C.iceMint} elevation={0} style={{ padding: 16, marginTop: 10 }}>
        <Text style={s.pinTitle}>UPDATE 6-DIGIT PIN CODE</Text>
        <View style={[wide ? s.cardDetails : s.row, { marginTop: 8, gap: 12 }]}>
          <TextInput
            value={newPin}
            onChangeText={(t) => { if (t.length <= 6 && /^\d*$/.test(t)) setNewPin(t); }}
            placeholder="New 6-Digit PIN"
            placeholderTextColor="#9AA5A0"
            keyboardType="number-pad"
            style={[s.input, wide && s.wideInput]}
          />
          <Button title="Save PIN" onPress={savePin} radius={12} height={48} fontSize={14} />
        </View>
        {pinMessage != null ? <Text style={s.pinMessage}>{pinMessage}</Text> : null}
      </Card>
  ) : null;
  const back = <OutlinedButton title="Back to main menu" onPress={onBackToMenu} radius={16} borderColor={C.warmGray} />;
  const transactions = <OutlinedButton title="View transaction history" onPress={() => setShowTransactions(true)} />;

  if (showTransactions) {
    return (
      <ServiceLayout wide={wide} summary={summary}>
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(row) => row.key}
          ListHeaderComponent={(
            <View style={s.accountActions}>
              <Text accessibilityRole="header" style={s.historyTitle}>Transaction history</Text>
              <OutlinedButton title="Back to card & account" onPress={() => setShowTransactions(false)} />
            </View>
          )}
          ListEmptyComponent={<Text style={s.empty}>No transactions yet.</Text>}
          persistentScrollbar
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: row }) => (row.kind === 'deposit'
            ? <DepositRow d={row.item} onViewReceipt={() => setReceipt(row)} />
            : <RedemptionRow r={row.item} onViewReceipt={() => setReceipt(row)} />)}
        />
        {receipt?.kind === 'deposit' ? <DepositReceipt deposit={receipt.item} onClose={() => setReceipt(null)} /> : null}
        {receipt?.kind === 'redeem' ? <RedemptionReceipt redemption={receipt.item} onClose={() => setReceipt(null)} /> : null}
      </ServiceLayout>
    );
  }

  return (
    <ServiceLayout wide={wide} summary={summary} actions={!wide && back}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.accountActions} keyboardShouldPersistTaps="handled">
        {!wide && summary}
        {wide && changePin}
        {pinForm}
        {transactions}
        {wide && back}
      </ScrollView>
    </ServiceLayout>
  );
}

function DepositRow({ d, onViewReceipt }) {
  return (
    <Card radius={12} style={s.rowCard} onPress={onViewReceipt}>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{d.categoryName}</Text>
        <Text style={s.rowSub}>{formatKg(d.weightKg)} kg · {formatDate(d.timestamp)}</Text>
        {d.location ? <Text style={s.rowSub}>{d.location}</Text> : null}
        <Text style={s.receiptLink}>View receipt</Text>
      </View>
      <Text style={[s.points, { color: C.darkPine }]}>+{d.pointsEarned} PTS</Text>
    </Card>
  );
}

function RedemptionRow({ r, onViewReceipt }) {
  return (
    <Card radius={12} style={s.rowCard} onPress={onViewReceipt}>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{r.itemTitle}</Text>
        <Text style={s.rowSub}>Redeemed | {formatDate(r.timestamp)}</Text>
        <Text style={s.receiptLink}>View receipt</Text>
      </View>
      <Text style={[s.points, { color: C.error }]}>-{r.pointsDeducted} PTS</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDetails: { gap: 4 },
  cardBrand: { fontSize: 11, fontWeight: '900', color: C.goldAmber, letterSpacing: 1 },
  chip: { width: 38, height: 28, borderRadius: 6, backgroundColor: C.chip, marginTop: 16, marginBottom: 14 },
  name: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 0.5 },
  uid: { fontSize: 12, fontFamily: 'monospace', color: alpha(C.white, 0.85) },
  barangay: { fontSize: 11, color: alpha(C.white, 0.75) },
  stat: { flex: 1, borderRadius: 14, padding: 12, backgroundColor: alpha(C.white, 0.18) },
  statLabel: { fontSize: 9, color: alpha(C.white, 0.8), fontWeight: '700' },
  statValue: { fontSize: 20, fontWeight: '900' },
  pinTitle: { fontSize: 13, fontWeight: '700', color: C.darkPine },
  input: { flex: 1, borderWidth: 1, borderColor: C.warmGray, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: C.white, color: C.deepNavy },
  pinMessage: { fontSize: 12, color: C.darkPine, fontWeight: '700', marginTop: 4 },
  wideInput: { flex: 0 },
  accountActions: { gap: 10 },
  historyTitle: { fontSize: 20, fontWeight: '900', color: C.darkPine },
  empty: { fontSize: 13, color: C.textMuted, marginTop: 12 },
  rowCard: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCopy: { flex: 1, marginRight: 12 },
  rowTitle: { fontWeight: '700', fontSize: 14, color: C.deepNavy },
  rowSub: { fontSize: 11, color: C.textMuted },
  receiptLink: { fontSize: 11, color: C.darkPine, fontWeight: '700' },
  points: { fontWeight: '900', fontSize: 15 },
});
