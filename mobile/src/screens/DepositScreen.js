import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card, Heading, Loading, SectionTitle, StationCard } from '../components';
import { st } from './HomeScreen';
import { C } from '../theme';

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function DepositScreen({ deposit, categories, categoriesError, stations, stationsError }) {
  const [categoryId, setCategoryId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const waiting = deposit.phase === 'waiting';

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [waiting]);

  useEffect(() => {
    if (!categoryId && categories?.length) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const chosen = categories?.find((c) => c.id === categoryId);

  if (waiting) {
    return (
      <>
        <Heading eyebrow="AT THE KIOSK" title="Drop your" accent="bottles." />
        <Card style={dp.waitCard}>
          <Text style={dp.big}>{clock(deposit.deadline - now)}</Text>
          <Text style={dp.waitTitle}>Waiting for the machine · {deposit.session.categoryName}</Text>
          <Text style={dp.waitCopy}>
            Go to kiosk {deposit.session.stationId} and put your {deposit.session.categoryName} into the machine.
            Its scale weighs the plastic and your points are added automatically. This screen updates when it's done.
          </Text>
        </Card>
        <Button kind="outline" onPress={deposit.cancel}>Cancel this deposit</Button>
      </>
    );
  }

  if (deposit.phase === 'done' && deposit.result) {
    const r = deposit.result;
    return (
      <>
        <Heading eyebrow="DEPOSIT COMPLETE" title="Thank you for" accent="recycling." />
        <View style={st.hero}>
          <View style={st.heroDecoration} />
          <Text style={st.heroLabel}>POINTS EARNED</Text>
          <View style={st.pointsLine}><Text style={st.points}>+{r.pointsEarned}</Text><Text style={st.pointsUnit}>points</Text></View>
          <Text style={st.heroCopy}>{r.weightKg} kg of {r.categoryName} measured by the machine.</Text>
        </View>
        {r.categoryMismatch ? <Banner>The machine detected {r.categoryName}, which differs from the category you picked. Points were awarded for what was measured.</Banner> : null}
        <Button onPress={deposit.reset}>Done</Button>
      </>
    );
  }

  return (
    <>
      <Heading eyebrow="RECYCLE & EARN" title="Deposit at a" accent="kiosk."
        intro="Deposits are weighed and sorted by the machine itself, so weights can't be typed in or edited. Pick what you're recycling, then use the machine." />
      {deposit.phase === 'failed' ? <Banner kind="error" onClose={deposit.reset}>{deposit.message}</Banner> : null}
      <SectionTitle eyebrow="STEP 1" title="What are you recycling?" />
      {categories === null && !categoriesError ? <Loading /> : null}
      {categoriesError ? <Banner kind="error">{categoriesError}</Banner> : null}
      <View style={{ gap: 9, marginBottom: 18 }}>
        {(categories || []).map((c) => (
          <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected: c.id === categoryId }}
            onPress={() => setCategoryId(c.id)} style={[dp.choice, c.id === categoryId && dp.choiceOn]}>
            <View style={[dp.radio, c.id === categoryId && dp.radioOn]} />
            <View style={{ flex: 1 }}>
              <Text style={dp.choiceTitle}>{c.name}</Text>
              <Text style={dp.choiceDetail}>{c.pointsPerKg} points per kg</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <SectionTitle eyebrow="STEP 2" title="Start your deposit" />
      <Card style={{ backgroundColor: C.soft }}>
        <Text style={dp.how}>
          Tap Start, then put your {chosen ? chosen.name : 'plastic'} into the kiosk within 3 minutes.
          The machine weighs it and credits your points.
        </Text>
      </Card>
      <Button loading={deposit.phase === 'starting'} disabled={!chosen} onPress={() => deposit.start(categoryId)}>
        Start deposit
      </Button>
      <SectionTitle eyebrow="NEARBY" title="Kiosks" />
      {stations === null && !stationsError ? <Loading /> : null}
      {stationsError ? <Text style={st.cardCopy}>{stationsError}</Text> : null}
      {(stations || []).map((station) => <StationCard key={station.id} station={station} />)}
    </>
  );
}

const dp = StyleSheet.create({
  waitCard: { alignItems: 'center', paddingVertical: 28, backgroundColor: C.soft },
  big: { color: C.forest, fontSize: 54, fontWeight: '900', letterSpacing: -2 },
  waitTitle: { color: C.forest, fontSize: 14, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  waitCopy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.pale, padding: 15 },
  choiceOn: { borderColor: C.forest, backgroundColor: C.soft },
  radio: { width: 18, height: 18, borderWidth: 2, borderColor: C.muted, borderRadius: 9 },
  radioOn: { borderColor: C.forest, backgroundColor: C.leaf },
  choiceTitle: { color: C.forest, fontWeight: '800', fontSize: 13 },
  choiceDetail: { color: C.muted, fontSize: 11, marginTop: 3 },
  how: { color: C.forest, fontSize: 12, lineHeight: 18 },
});
