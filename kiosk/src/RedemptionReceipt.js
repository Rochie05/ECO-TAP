import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './components';
import { KIOSK_LOCATION } from './config';
import { formatDate } from './format';
import { C } from './theme';

export function RedemptionDialog({ title, onClose, children }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={s.backdrop} keyboardShouldPersistTaps="handled">
        <View style={s.dialog} accessibilityViewIsModal>
          <Card style={s.card}>
            <Text accessibilityRole="header" style={s.title}>{title}</Text>
            {children}
          </Card>
        </View>
      </ScrollView>
    </Modal>
  );
}

export default function RedemptionReceipt({ redemption, balance, onClose }) {
  return (
    <RedemptionDialog title="Redemption receipt" onClose={onClose}>
      <Text style={s.muted}>{KIOSK_LOCATION}</Text>
      <Text style={s.reward}>{redemption.itemTitle}</Text>
      <View style={s.details}>
        <Text style={s.detail}>Transaction ID · {redemption.id}</Text>
        <Text style={s.detail}>{formatDate(redemption.timestamp)}</Text>
        <Text style={s.detail}>{redemption.pointsDeducted} points deducted</Text>
        {balance != null ? <Text style={s.detail}>{balance} points remaining</Text> : null}
      </View>
      <Text style={s.muted}>Show this receipt to staff when claiming your reward.</Text>
      <Button title="Done" onPress={onClose} height={44} />
    </RedemptionDialog>
  );
}

export function DepositReceipt({ deposit, onClose }) {
  return (
    <RedemptionDialog title="Deposit receipt" onClose={onClose}>
      {deposit.location ? <Text style={s.muted}>{deposit.location}</Text> : null}
      <Text style={s.reward}>{deposit.categoryName}</Text>
      <View style={s.details}>
        <Text style={s.detail}>Transaction ID · DEP-{deposit.id}</Text>
        {deposit.batchId ? <Text style={s.detail}>Collection batch · {deposit.batchId}</Text> : null}
        <Text style={s.detail}>{formatDate(deposit.timestamp)}</Text>
        <Text style={s.detail}>Weight · {deposit.weightKg} kg</Text>
        <Text style={s.detail}>Points earned · +{deposit.pointsEarned}</Text>
      </View>
      <Button title="Done" onPress={onClose} height={44} />
    </RedemptionDialog>
  );
}

const s = StyleSheet.create({
  backdrop: { flexGrow: 1, justifyContent: 'center', padding: 14, backgroundColor: '#10251ECC' },
  dialog: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  card: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '900', color: C.darkPine },
  reward: { fontSize: 18, fontWeight: '800', color: C.darkPine },
  muted: { fontSize: 13, color: C.textMuted },
  details: { padding: 10, gap: 3, borderRadius: 12, backgroundColor: C.iceMint },
  detail: { fontSize: 13, color: C.darkPine },
});
