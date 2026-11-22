import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { alpha, C } from '../theme';
import { Button, Card, OutlinedButton } from '../components';

function Field({ label, placeholder, value, onChangeText, keyboardType, secure }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA5A0"
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCorrect={false}
        style={s.input}
      />
    </View>
  );
}

export default function RegisterResidentScreen({ scannedNfcCardId, onCreateAccount, onCancel }) {
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const submit = () => {
    if (!fullName.trim()) setErrorMessage('Please enter resident full name.');
    else if (pinCode.length !== 6) setErrorMessage('PIN code must be exactly 6 digits.');
    else { setErrorMessage(null); onCreateAccount(fullName, address, pinCode); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.surfaceBg }} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Card radius={22} color={C.darkPine} elevation={6} style={{ padding: 20, alignItems: 'center' }}>
        <View style={s.tag}><Text style={s.tagText}>NEW NFC CARD DETECTED</Text></View>
        <Text style={s.title}>Resident Account Setup</Text>
        <Text style={s.sub}>Link this NFC card to a new resident profile to start earning Eco-Points</Text>
      </Card>

      <Card radius={16} elevation={2} style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
        <View style={s.cardIcon}><Text style={{ fontSize: 24 }}>💳</Text></View>
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={s.uidLabel}>DETECTED NFC CARD UID</Text>
          <Text style={s.uid}>{scannedNfcCardId}</Text>
        </View>
      </Card>

      <Card radius={20} elevation={2} style={{ padding: 20 }}>
        <Text style={s.formTitle}>RESIDENT REGISTRATION FORM</Text>
        <View style={{ marginTop: 4 }}>
          <Field label="Resident Full Name" placeholder="e.g. Juan Dela Cruz" value={fullName} onChangeText={setFullName} />
          <Field label="Barangay Address" placeholder="e.g. 12 Mayaman St, Quezon City" value={address} onChangeText={setAddress} />
          <Field
            label="Set 6-Digit Security PIN"
            placeholder="e.g. 123456"
            value={pinCode}
            keyboardType="number-pad"
            onChangeText={(t) => { if (t.length <= 6 && /^\d*$/.test(t)) setPinCode(t); }}
          />
        </View>
        {errorMessage != null ? <Text style={s.error}>{errorMessage}</Text> : null}
      </Card>

      <View style={{ gap: 10, marginTop: 4 }}>
        <Button title="Create Account & Link Card ➔" onPress={submit} height={52} fontSize={15} />
        <OutlinedButton title="Cancel" onPress={onCancel} textColor={C.textMuted} borderColor={C.warmGray} radius={16} fontSize={14} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tag: { backgroundColor: C.goldAmber, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '900', color: C.black },
  title: { fontSize: 22, fontWeight: '900', color: C.white, marginTop: 8 },
  sub: { fontSize: 12, color: alpha(C.white, 0.85), textAlign: 'center', marginTop: 2 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldAmber, alignItems: 'center', justifyContent: 'center' },
  uidLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted },
  uid: { fontSize: 16, fontWeight: '900', fontFamily: 'monospace', color: C.darkPine },
  formTitle: { fontSize: 12, fontWeight: '900', color: C.darkPine, letterSpacing: 0.8 },
  label: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: C.warmGray, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.deepNavy },
  error: { color: C.error, fontSize: 12, fontWeight: '700', marginTop: 8 },
});
