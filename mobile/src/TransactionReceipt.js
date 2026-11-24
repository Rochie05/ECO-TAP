import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, formatTimestamp } from './components';
import { C } from './theme';

export default function TransactionReceipt({ transaction, kind, balance, onClose }) {
  const deposit = kind === 'deposit';
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={s.backdrop}>
        <View style={s.dialog} accessibilityViewIsModal>
          <Card style={s.card}>
            <Text accessibilityRole="header" style={s.title}>{deposit ? 'Deposit receipt' : 'Redemption receipt'}</Text>
            <Text style={s.detail}>Transaction ID · {deposit ? `DEP-${transaction.id}` : transaction.id}</Text>
            <Text style={s.detail}>{formatTimestamp(transaction.timestamp)}</Text>
            {transaction.location ? <Text style={s.detail}>{transaction.location}</Text> : null}
            {transaction.batchId ? <Text style={s.detail}>Collection batch · {transaction.batchId}</Text> : null}
            {deposit ? (
              <>
                <Text style={s.detail}>Plastic type · {transaction.categoryName}</Text>
                <Text style={s.detail}>Weight · {transaction.weightKg} kg</Text>
                <Text style={s.detail}>Points earned · +{transaction.pointsEarned}</Text>
              </>
            ) : (
              <>
                <Text style={s.detail}>Reward · {transaction.itemTitle}</Text>
                <Text style={s.detail}>Points deducted · {transaction.pointsDeducted}</Text>
                {balance != null ? <Text style={s.detail}>Remaining balance · {balance} points</Text> : null}
                {transaction.status === 'pending' ? <Text style={s.detail}>Pending pickup. Show this receipt to staff.</Text> : null}
                {transaction.status === 'fulfilled' ? <Text style={s.detail}>Reward collected.</Text> : null}
              </>
            )}
            <Button onPress={onClose}>Done</Button>
          </Card>
        </View>
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flexGrow: 1, justifyContent: 'center', padding: 16, backgroundColor: '#10251ECC' },
  dialog: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  card: { gap: 9, marginBottom: 0 },
  title: { fontSize: 22, fontWeight: '900', color: C.forest },
  detail: { fontSize: 14, color: C.muted },
});
