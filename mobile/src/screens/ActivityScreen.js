import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, SectionTitle, formatTimestamp } from '../components';
import TransactionReceipt from '../TransactionReceipt';
import { st } from './HomeScreen';
import { C } from '../theme';

export default function ActivityScreen({ resident, deposits, redemptions }) {
  const [receipt, setReceipt] = useState(null);
  const items = [
    ...deposits.map((d) => ({ key: `d-${d.id}`, kind: 'deposit', title: d.categoryName, sub: `${d.weightKg} kg`, points: d.pointsEarned, at: d.timestamp, transaction: d })),
    ...redemptions.map((r) => ({ key: `r-${r.id}`, kind: 'reward', title: r.itemTitle, sub: 'Reward redeemed', points: r.pointsDeducted, at: r.timestamp, transaction: r })),
  ].sort((a, b) => b.at - a.at);

  return (
    <>
      <Heading eyebrow="YOUR RECYCLING STORY" title="Every step" accent="counts."
        intro="Your latest deposits and reward redemptions in one place." />
      <View style={st.statGrid}>
        <Card style={st.statCard}><Text style={st.statValue}>{deposits.length}</Text><Text style={st.statLabel}>Recent deposits</Text></Card>
        <Card style={st.statCard}><Text style={st.statValue}>{resident.totalWasteKg.toFixed(1)} kg</Text><Text style={st.statLabel}>Total plastic collected</Text></Card>
      </View>
      <SectionTitle eyebrow="RECENT ACTIVITY" title="History" />
      {items.length === 0 ? <Text style={st.cardCopy}>Nothing yet. Your first deposit will show up here.</Text> : null}
      {items.map((item) => (
        <Card key={item.key} style={ac.card}>
          <View style={[ac.icon, item.kind === 'reward' && ac.iconReward]}><Text style={ac.iconText}>{item.kind === 'reward' ? '◇' : '♻'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>{item.title}</Text>
            <Text style={st.cardCopy}>{item.sub} · {formatTimestamp(item.at)}</Text>
            {item.transaction.location ? <Text style={st.cardCopy}>{item.transaction.location}</Text> : null}
            <Button kind="outline" onPress={() => setReceipt(item)} style={ac.receiptButton}>View receipt</Button>
          </View>
          <Text style={[ac.points, item.kind === 'reward' && ac.debit]}>{item.kind === 'reward' ? '−' : '+'}{item.points} pts</Text>
        </Card>
      ))}
      {receipt ? <TransactionReceipt transaction={receipt.transaction} kind={receipt.kind} onClose={() => setReceipt(null)} /> : null}
    </>
  );
}

const ac = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  iconReward: { backgroundColor: '#F9EED9' },
  iconText: { color: C.forest, fontSize: 23 },
  points: { color: C.leaf, fontSize: 15, fontWeight: '900' },
  debit: { color: C.forest },
  receiptButton: { alignSelf: 'flex-start', marginTop: 8 },
});
