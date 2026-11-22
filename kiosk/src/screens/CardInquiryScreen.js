import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { alpha, C } from '../theme';
import { Button, Card, OutlinedButton } from '../components';
import { formatDate, formatKg } from '../format';

// Compose gradient colors, flattened to the first stop (no gradient dependency).
const CARD_GREEN = C.darkPine;

export default function CardInquiryScreen({ user, deposits, redemptions, onUpdatePin, onBackToMenu }) {
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState(null);

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

  const header = (
    <View>
      <Card radius={22} color={CARD_GREEN} elevation={6} style={{ padding: 20 }}>
        <View style={s.between}>
          <View style={s.row}>
            <Text style={{ fontSize: 20 }}>🌱 </Text>
            <Text style={s.cardBrand}>QUEZON CITY ECO-CARD</Text>
          </View>
          <Button title="Change PIN" onPress={() => setShowPin(!showPin)} color={C.goldAmber} textColor={C.black} radius={12} height={32} fontSize={11} />
        </View>

        <View style={s.chip} />

        <Text style={s.name}>{user.fullName.toUpperCase()}</Text>
        <View style={s.between}>
          <Text style={s.uid}>UID: {user.nfcCardId}</Text>
          <Text style={s.barangay}>{user.barangay}</Text>
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

      {showPin ? (
        <Card radius={16} color={C.iceMint} elevation={0} style={{ padding: 16, marginTop: 10 }}>
          <Text style={s.pinTitle}>UPDATE 6-DIGIT PIN CODE</Text>
          <View style={[s.row, { marginTop: 8, gap: 12 }]}>
            <TextInput
              value={newPin}
              onChangeText={(t) => { if (t.length <= 6 && /^\d*$/.test(t)) setNewPin(t); }}
              placeholder="New 6-Digit PIN"
              placeholderTextColor="#9AA5A0"
              keyboardType="number-pad"
              style={s.input}
            />
            <Button title="Save PIN" onPress={savePin} radius={12} height={48} fontSize={14} />
          </View>
          {pinMessage != null ? <Text style={s.pinMessage}>{pinMessage}</Text> : null}
        </Card>
      ) : null}

      <Text style={s.ledger}>ACTIVITY TRANSACTION LEDGER</Text>
    </View>
  );

  return (
    <View style={s.screen}>
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item: row }) => (row.kind === 'deposit' ? <DepositRow d={row.item} /> : <RedemptionRow r={row.item} />)}
      />
      <OutlinedButton title="← Back to Main Service Menu" onPress={onBackToMenu} radius={16} borderColor={C.warmGray} style={{ marginTop: 10 }} />
    </View>
  );
}

function DepositRow({ d }) {
  return (
    <Card radius={12} style={s.rowCard}>
      <View style={s.row}>
        <View style={[s.circle, { backgroundColor: C.iceMint }]}><Text style={{ fontSize: 18 }}>♻️</Text></View>
        <View style={{ marginLeft: 12 }}>
          <Text style={s.rowTitle}>{d.categoryName}</Text>
          <Text style={s.rowSub}>{formatKg(d.weightKg)} kg | {formatDate(d.timestamp)}</Text>
        </View>
      </View>
      <Text style={[s.points, { color: C.darkPine }]}>+{d.pointsEarned} PTS</Text>
    </Card>
  );
}

function RedemptionRow({ r }) {
  return (
    <Card radius={12} style={s.rowCard}>
      <View style={s.row}>
        <View style={[s.circle, { backgroundColor: C.amberSoft }]}><Text style={{ fontSize: 18 }}>🛍️</Text></View>
        <View style={{ marginLeft: 12 }}>
          <Text style={s.rowTitle}>{r.itemTitle}</Text>
          <Text style={s.rowSub}>Redeemed | {formatDate(r.timestamp)}</Text>
        </View>
      </View>
      <Text style={[s.points, { color: C.error }]}>-{r.pointsDeducted} PTS</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surfaceBg, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  ledger: { fontSize: 12, fontWeight: '700', color: C.darkPine, marginTop: 14, marginBottom: 6 },
  rowCard: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontWeight: '700', fontSize: 14, color: C.deepNavy },
  rowSub: { fontSize: 11, color: C.textMuted },
  points: { fontWeight: '900', fontSize: 15 },
});
