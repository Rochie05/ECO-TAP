import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, normalizeCardId, setToken } from '../api';
import { clearLastCard, loadLastCard, saveLastCard } from '../config';
import { nfcStatus, openNfcSettings, startCardReader } from '../nfc';
import { Banner, Button, Card, Field, Heading, s } from '../components';
import { C } from '../theme';

// Steps: card (enter or tap) -> pin (known card) | register (new card).
export default function AuthScreen({ onAuthenticated, notice }) {
  const [step, setStep] = useState('card');
  const [card, setCard] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nfc, setNfc] = useState('checking');
  const stopReader = useRef(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => { loadLastCard().then((c) => { if (c) setCard(c); }); }, []);

  // Listen for a card tap while the card step is on screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await nfcStatus();
      if (cancelled) return;
      setNfc(status);
      if (status !== 'ready') return;
      try {
        const stop = await startCardReader((id) => { if (stepRef.current === 'card') { setCard(id); setError(''); lookup(id); } });
        if (cancelled) stop(); else stopReader.current = stop;
      } catch { setNfc('unavailable'); }
    })();
    return () => { cancelled = true; stopReader.current?.(); stopReader.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(value = card) {
    const id = normalizeCardId(value);
    if (!id) { setError('Enter the card ID printed on your ECO-TAP card, or tap the card on the back of your phone.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api.lookupCard(id);
      setCard(result.nfcCardId);
      setPin(''); setPin2('');
      setStep(result.registered ? 'pin' : 'register');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function signIn(cardId, pinValue) {
    const result = await api.login(cardId, pinValue);
    setToken(result.token);
    await saveLastCard(cardId);
    onAuthenticated(result.resident);
  }

  async function submitPin() {
    if (!/^\d{6}$/.test(pin)) { setError('Your PIN is exactly 6 digits.'); return; }
    setBusy(true); setError('');
    try { await signIn(card, pin); }
    catch (e) { setError(e.message); setPin(''); setBusy(false); }
  }

  async function submitRegister() {
    if (!name.trim()) { setError('Enter your full name.'); return; }
    if (!/^\d{6}$/.test(pin)) { setError('Choose a PIN of exactly 6 digits.'); return; }
    if (pin !== pin2) { setError('The two PINs do not match.'); return; }
    setBusy(true); setError('');
    try {
      await api.register({ nfcCardId: card, fullName: name.trim(), address: address.trim(), pin });
      await signIn(card, pin);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  function otherCard() { clearLastCard(); setCard(''); setPin(''); setError(''); setStep('card'); }

  return (
    <View>
      <Heading eyebrow="SMALL ACTIONS, GREENER COMMUNITIES"
        title={step === 'register' ? 'Create your' : 'Welcome to'} accent={step === 'register' ? 'account.' : 'ECO-TAP.'}
        intro={step === 'card' ? 'Sign in with your ECO-TAP card. Tap it on the back of your phone or type the card ID.'
          : step === 'pin' ? 'Enter your 6-digit PIN to continue.'
          : 'This card is new. Register it to create your ECO-TAP account.'} />

      <Banner kind="error">{notice}</Banner>
      <Banner kind="error" onClose={() => setError('')}>{error}</Banner>

      {step === 'card' && (
        <Card>
          <Field label="Card ID" value={card} onChangeText={setCard} autoCapitalize="characters" autoCorrect={false}
            placeholder="ECO-TAP-04A1B2C3" returnKeyType="go" onSubmitEditing={() => lookup()} />
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 14 }}>
            {nfc === 'ready' ? 'NFC is on: hold your card against the back of the phone.'
              : nfc === 'disabled' ? 'NFC is turned off on this phone.'
              : nfc === 'unavailable' ? 'This phone cannot read NFC cards here, so type the card ID.' : ''}
            {nfc === 'disabled' ? <Text onPress={openNfcSettings} style={{ color: C.forest, fontWeight: '800' }}>  Open NFC settings</Text> : null}
          </Text>
          <Button loading={busy} onPress={() => lookup()}>Continue</Button>
        </Card>
      )}

      {step === 'pin' && (
        <Card>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>Card {card}</Text>
          <Field label="6-digit PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" secureTextEntry maxLength={6} autoFocus placeholder="••••••"
            returnKeyType="go" onSubmitEditing={submitPin} style={{ letterSpacing: 8, fontSize: 22 }} />
          <Button loading={busy} onPress={submitPin}>Sign in</Button>
          <Pressable onPress={otherCard} style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
            <Text style={s.textLink}>Use a different card</Text>
          </Pressable>
        </Card>
      )}

      {step === 'register' && (
        <Card>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>Card {card}</Text>
          <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Juan Dela Cruz" />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Street, barangay" />
          <Field label="Choose a 6-digit PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" />
          <Field label="Repeat PIN" value={pin2} onChangeText={(t) => setPin2(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" />
          <Button loading={busy} onPress={submitRegister}>Register and sign in</Button>
          <Pressable onPress={otherCard} style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
            <Text style={s.textLink}>Use a different card</Text>
          </Pressable>
        </Card>
      )}

    </View>
  );
}
