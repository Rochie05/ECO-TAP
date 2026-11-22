import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Banner, Button, Card, Field, Heading, SectionTitle } from '../components';
import { st } from './HomeScreen';
import { C } from '../theme';

export default function ProfileScreen({ resident, onLogout }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const initials = resident.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  async function changePin() {
    if (!/^\d{6}$/.test(pin)) { setMsg({ kind: 'error', text: 'Your new PIN must be exactly 6 digits.' }); return; }
    if (pin !== pin2) { setMsg({ kind: 'error', text: 'The two PINs do not match.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await api.changePin(pin);
      setPin(''); setPin2('');
      setMsg({ kind: 'info', text: 'PIN changed. Use it the next time you sign in.' });
    } catch (error) { setMsg({ kind: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Heading eyebrow="YOUR ECO-TAP ACCOUNT" title="Hello," accent={`${resident.fullName.split(' ')[0]}.`}
        intro="A small action today can make a bigger difference tomorrow." />
      <Card style={pf.profile}>
        <View style={pf.avatar}><Text style={pf.avatarText}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={pf.name}>{resident.fullName}</Text>
          <Text style={pf.detail}>{resident.id} · {resident.nfcCardId}</Text>
          <Text style={pf.detail}>{resident.address ? `${resident.address} · ` : ''}{resident.barangay}</Text>
          {resident.registeredDate ? <Text style={pf.detail}>Member since {resident.registeredDate}</Text> : null}
        </View>
      </Card>
      <SectionTitle eyebrow="SECURITY" title="Change PIN" />
      <Banner kind={msg?.kind} onClose={() => setMsg(null)}>{msg?.text}</Banner>
      <Card>
        <Field label="New 6-digit PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" />
        <Field label="Repeat new PIN" value={pin2} onChangeText={(t) => setPin2(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" />
        <Button loading={busy} onPress={changePin}>Update PIN</Button>
      </Card>
      <SectionTitle eyebrow="HOW IT WORKS" title="Recycling made simple" />
      {[['01', 'Sort your plastic', 'Separate PET bottles and HDPE containers.'], ['02', 'Visit a kiosk', 'Pick the category in this app, then use the machine.'], ['03', 'Earn rewards', 'Collect points and redeem useful items.']].map(([n, title, copy]) => (
        <Card key={n} style={pf.how}>
          <View style={pf.step}><Text style={pf.stepText}>{n}</Text></View>
          <View style={{ flex: 1 }}><Text style={st.cardTitle}>{title}</Text><Text style={st.cardCopy}>{copy}</Text></View>
        </Card>
      ))}
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button kind="danger" onPress={onLogout}>Sign out</Button>
      </View>
    </>
  );
}

const pf = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 19 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.paper, fontWeight: '900', fontSize: 15 },
  name: { color: C.forest, fontSize: 17, fontWeight: '900' },
  detail: { color: C.muted, fontSize: 11, marginTop: 4 },
  how: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13 },
  step: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.forest, fontWeight: '900', fontSize: 12 },
});
