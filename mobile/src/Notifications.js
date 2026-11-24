import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';
import { formatTimestamp } from './components';

export function NotificationsButton({ onPress, unread = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unread ? 'Notifications, new activity' : 'Notifications'}
      onPress={onPress} style={s.bellButton}>
      <View style={s.bell} /><View style={s.bellBase} /><View style={s.clapper} />
      {unread ? <View style={s.dot} /> : null}
    </Pressable>
  );
}

const TITLES = {
  login: 'Signed in at kiosk', logout: 'Signed out at kiosk', deposit: 'Deposit recorded',
  batch_dispatched: 'Batch on the way', batch_checkpoint: 'Batch reached a stop',
  batch_arrived: 'Batch delivered', batch_converted: 'Batch converted',
};

function batchUpdate(item) {
  const material = `The ${item.material} batch you contributed ${item.contributedKg} kg to`;
  if (item.kind === 'batch_dispatched') return `${material} left ${item.origin} for ${item.location}.`;
  if (item.kind === 'batch_converted') return `${material} was made into ${item.quantity} × ${item.product}.`;
  return `${material} has arrived at ${item.location}.`;
}

export function NotificationsDialog({ items, error, onRefresh, onClose }) {
  return (
    <Modal animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.dialog} accessibilityViewIsModal>
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.title}>Notifications</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={s.action}><Text style={s.actionText}>Close</Text></Pressable>
          </View>
          <ScrollView style={s.list} contentContainerStyle={s.rows}>
            {error ? <Text accessibilityLiveRegion="polite" style={s.copy}>{error}</Text> : null}
            {!error && items.length === 0 ? <Text style={s.copy}>No kiosk activity yet.</Text> : null}
            {items.map((item) => (
              <View key={item.id} style={s.row}>
                <Text style={s.heading}>{TITLES[item.kind] || 'Kiosk activity'}</Text>
                <Text style={s.copy}>{item.location ? item.location + ' · ' : ''}{formatTimestamp(item.timestamp)}</Text>
                {item.kind === 'deposit' ? (
                  <Text style={s.copy}>{item.categoryName} · {item.weightKg} kg · +{item.pointsEarned} points</Text>
                ) : null}
                {item.batchId && item.kind.startsWith('batch_') ? (
                  <>
                    <Text style={s.copy}>{batchUpdate(item)}</Text>
                    <Text style={s.copy}>{item.batchId}</Text>
                  </>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onRefresh} style={s.action}><Text style={s.actionText}>Refresh</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bellButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft },
  bell: { width: 14, height: 14, borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderColor: C.forest },
  bellBase: { width: 19, height: 2, backgroundColor: C.forest },
  clapper: { width: 4, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: C.forest, marginTop: 1 },
  dot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: C.leaf },
  backdrop: { flex: 1, padding: 14, backgroundColor: '#10251ECC', alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 540, maxHeight: '90%', padding: 16, gap: 10, borderRadius: 20, backgroundColor: C.paper },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: C.forest },
  list: { flexShrink: 1 },
  rows: { gap: 8 },
  row: { padding: 12, borderRadius: 12, backgroundColor: C.soft, gap: 4 },
  heading: { fontSize: 14, fontWeight: '800', color: C.forest },
  copy: { fontSize: 13, color: C.muted },
  action: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 13, borderRadius: 12, backgroundColor: C.soft },
  actionText: { fontSize: 13, fontWeight: '800', color: C.forest },
});
