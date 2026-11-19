import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, newIdempotencyKey } from '../api';
import { Banner, Button, Card, Heading, Loading, SectionTitle } from '../components';
import { st } from './HomeScreen';
import { C } from '../theme';

const ICONS = ['✿', '▧', '◇', '❖', '✦'];

export default function RewardsScreen({ resident, rewards, rewardsError, onRedeemed, reload }) {
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  // One key per reward until it succeeds, so a retry after a dropped connection can't spend points twice.
  const keys = useRef({});

  function redeem(reward) {
    Alert.alert('Redeem reward?', `${reward.title} costs ${reward.pointsCost} points. You'll have ${resident.ecoPoints - reward.pointsCost} left.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Redeem', onPress: async () => {
        setBusyId(reward.id); setMessage(null);
        keys.current[reward.id] = keys.current[reward.id] || newIdempotencyKey(`${resident.id}-${reward.id}`);
        try {
          const result = await api.redeem(reward.id, keys.current[reward.id]);
          delete keys.current[reward.id];
          onRedeemed(result.resident);
          setMessage({ kind: 'info', text: `${reward.title} redeemed. Collect it from the Waste Management Department.` });
        } catch (error) {
          if (error.status && error.status < 500) delete keys.current[reward.id];
          setMessage({ kind: 'error', text: error.message });
        } finally { setBusyId(null); }
      } },
    ]);
  }

  return (
    <>
      <Heading eyebrow="GOOD DEEDS, GOOD REWARDS" title="Your effort" accent="pays off."
        intro="Use your points for useful rewards that help you keep living green." />
      <Banner kind={message?.kind} onClose={() => setMessage(null)}>{message?.text}</Banner>
      <View style={rw.balance}>
        <Text style={rw.balanceLabel}>AVAILABLE POINTS</Text>
        <Text style={rw.balancePoints}>{resident.ecoPoints}</Text>
        <Text style={rw.balanceSub}>Every bottle makes a difference.</Text>
      </View>
      <SectionTitle eyebrow="REWARD COLLECTION" title="Choose your reward" />
      {rewards === null && !rewardsError ? <Loading /> : null}
      {rewardsError ? <Banner kind="error">{rewardsError}</Banner> : null}
      {rewardsError ? <Button kind="outline" onPress={reload}>Try again</Button> : null}
      {rewards && rewards.length === 0 ? <Text style={st.cardCopy}>No rewards are available yet.</Text> : null}
      {(rewards || []).map((reward, i) => (
        <Card key={reward.id} style={rw.card}>
          <View style={rw.icon}><Text style={rw.iconText}>{ICONS[i % ICONS.length]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>{reward.title}</Text>
            {reward.description ? <Text style={st.cardCopy}>{reward.description}</Text> : null}
            <Text style={rw.cost}>{reward.pointsCost} points</Text>
          </View>
          <Button kind="outline" loading={busyId === reward.id} disabled={busyId !== null || resident.ecoPoints < reward.pointsCost}
            onPress={() => redeem(reward)} style={rw.button}>Redeem</Button>
        </Card>
      ))}
      <Text style={rw.foot}>Redeemed rewards show as pending until staff hand the item over.</Text>
    </>
  );
}

const rw = StyleSheet.create({
  balance: { borderRadius: 22, backgroundColor: C.forest, padding: 22, marginBottom: 17 },
  balanceLabel: { color: C.leaf, fontWeight: '900', letterSpacing: 1.3, fontSize: 10 },
  balancePoints: { color: C.paper, fontSize: 54, fontWeight: '900', marginTop: 5 },
  balanceSub: { color: '#D6E6D6', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: C.forest, fontSize: 25 },
  cost: { color: C.forest, fontWeight: '900', fontSize: 11, marginTop: 10 },
  button: { minHeight: 38, paddingHorizontal: 12 },
  foot: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 15, marginBottom: 8 },
});
