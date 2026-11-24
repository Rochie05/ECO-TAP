import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alpha, C } from '../theme';
import { Button, Card, HeaderCard, OutlinedButton, ServiceLayout } from '../components';

const POLL_INTERVAL_MS = 1500;

const TITLES = {
  CATEGORY: '1 of 2 · Select waste category',
  WEIGHING: '2 of 2 · Machine is weighing',
  DONE: 'Deposit complete',
};

/**
 * Deposit Segregated Waste: 1) select waste category, 2) the machine weighs the waste, 3) points are awarded.
 *
 * There is deliberately NO way to enter or adjust a weight here. The resident only chooses a category, which
 * opens a deposit session on the server. The machine's load cell and optical sensor report the measured weight
 * and detected material, and the server calculates and awards the points. This screen just waits for that result.
 */
export default function DepositScreen({ wide, user, categories, busy, onStart, onPoll, onCancel, onBackToMenu }) {
  const [step, setStep] = useState('CATEGORY');
  const [category, setCategory] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [recorded, setRecorded] = useState(null);
  const [notice, setNotice] = useState(null);

  const startOver = () => { setCategory(null); setSessionId(null); setRecorded(null); setStep('CATEGORY'); };

  // Keep the latest callbacks without restarting the polling loop on every render.
  const latest = useRef({});
  latest.current = { onPoll, startOver };

  // While waiting, ask the server whether the machine has reported a measured weight yet.
  useEffect(() => {
    if (step !== 'WEIGHING' || !sessionId) return undefined;
    let cancelled = false;
    let timer;
    const tick = async () => {
      const status = await latest.current.onPoll(sessionId);
      if (cancelled) return;
      if (status?.status === 'completed') { setRecorded(status.deposit); setStep('DONE'); return; }
      if (status?.status === 'expired') { setNotice('No deposit was detected. Please start again.'); latest.current.startOver(); return; }
      if (status?.status === 'cancelled') { latest.current.startOver(); return; }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [step, sessionId]);

  const start = async () => {
    if (!category) return;
    setNotice(null);
    const id = await onStart(category);
    if (id) { setSessionId(id); setStep('WEIGHING'); }
  };

  const summary = (
    <HeaderCard
      eyebrow="DEPOSIT SEGREGATED WASTE"
      title={TITLES[step]}
      subtitle={`Resident: ${user.fullName} · ${user.ecoPoints} pts`}
    />
  );
  const actions = (
    <View style={[s.actions, wide && s.stackedActions]}>
      {step === 'CATEGORY' ? (
        <>
          <OutlinedButton title="Back to menu" onPress={onBackToMenu} style={!wide && s.action} radius={20} height={40} />
          <Button title={busy ? 'Starting…' : 'Start deposit'} disabled={!category || busy} onPress={start} style={!wide && s.action} radius={20} height={40} />
        </>
      ) : null}
      {step === 'WEIGHING' ? (
        <OutlinedButton
          title="Cancel deposit"
          onPress={() => { if (sessionId) onCancel(sessionId); startOver(); }}
          style={!wide && s.action}
          radius={20}
          height={40}
        />
      ) : null}
      {step === 'DONE' ? (
        <>
          <OutlinedButton title="Back to menu" onPress={onBackToMenu} style={!wide && s.action} radius={20} height={40} />
          <Button title="Deposit more" onPress={startOver} style={!wide && s.action} radius={20} height={40} />
        </>
      ) : null}
    </View>
  );

  return (
    <ServiceLayout wide={wide} summary={summary} actions={actions}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }} persistentScrollbar>
        {!wide && summary}
        {step === 'CATEGORY' ? (
          <>
            {notice ? <Text style={s.notice}>{notice}</Text> : null}
            {categories.length === 0 ? <Text style={s.loading}>Loading waste categories…</Text> : null}
            {categories.map((item) => {
              const selected = category?.id === item.id;
              return (
                <Card
                  key={item.id}
                  radius={14}
                  color={selected ? alpha(C.sageGreen, 0.25) : C.iceMint}
                  border={{ width: selected ? 2 : 1, color: selected ? C.darkPine : C.warmGray }}
                  onPress={() => setCategory(item)}
                  style={s.categoryRow}
                >
                  <View>
                    <Text style={s.categoryName}>{item.name}</Text>
                    <Text style={s.categoryBin}>Bin {String(item.section).toUpperCase()}</Text>
                  </View>
                  <Text style={s.categoryRate}>{item.pointsPerKg} pts / kg</Text>
                </Card>
              );
            })}
          </>
        ) : null}

        {step === 'WEIGHING' ? (
          <Card radius={16} color={C.iceMint} border={{ color: C.warmGray }} style={s.centerCard}>
            <ActivityIndicator size="large" color={C.darkPine} />
            <Text style={s.insert}>Insert your {category?.name ?? 'bottles'} into the machine</Text>
            <Text style={s.insertSub}>
              The machine weighs and sorts them for you. Your points appear here as soon as the scale reports the weight.
            </Text>
          </Card>
        ) : null}

        {step === 'DONE' ? (
          <Card radius={16} color={C.iceMint} border={{ color: C.warmGray }} style={[s.centerCard, { padding: 20 }]}>
            <Text style={{ fontSize: 36 }}>♻️</Text>
            <Text style={s.earned}>+{recorded?.pointsEarned ?? 0} Eco-Points</Text>
            <Text style={s.insertSub}>
              {Number(recorded?.weightKg ?? 0).toFixed(2)} kg of {recorded?.categoryName ?? ''} (weighed by the machine)
            </Text>
            <Text style={s.balance}>New balance: {user.ecoPoints} pts</Text>
          </Card>
        ) : null}
      </ScrollView>
    </ServiceLayout>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  stackedActions: { flexDirection: 'column' },
  action: { flex: 1 },
  notice: { fontSize: 13, fontWeight: '500', color: C.darkPine },
  loading: { fontSize: 13, color: C.darkPine },
  categoryRow: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryName: { fontSize: 16, fontWeight: '700', color: C.darkPine },
  categoryBin: { fontSize: 12, color: alpha(C.darkPine, 0.75) },
  categoryRate: { fontSize: 15, fontWeight: '700', color: C.darkPine },
  centerCard: { padding: 24, alignItems: 'center', gap: 12 },
  insert: { fontSize: 16, fontWeight: '700', color: C.darkPine, textAlign: 'center' },
  insertSub: { fontSize: 13, color: alpha(C.darkPine, 0.8), textAlign: 'center' },
  earned: { fontSize: 28, fontWeight: '700', color: C.darkPine },
  balance: { fontSize: 15, fontWeight: '700', color: C.darkPine, marginTop: 8 },
});
