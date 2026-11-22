import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alpha, C } from '../theme';
import { Card } from '../components';

const PAD_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['C', '0', 'X']];

export default function PinEntryScreen({ user, pinInput, errorMessage, onDigitEntered, onBackspace, onClear, onCancel }) {
  const press = (key) => {
    if (key === 'C') onClear();
    else if (key === 'X') onBackspace();
    else onDigitEntered(key);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Card radius={20} color={C.darkPine} elevation={2} style={s.greeting}>
        <View style={s.avatar}><Text style={{ fontSize: 26 }}>🪪</Text></View>
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={s.verified}>NFC CARD VERIFIED</Text>
          <Text style={s.name}>{user.fullName}</Text>
          <Text style={s.uid}>{user.barangay}</Text>
        </View>
      </Card>

      <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
        <Text style={s.prompt}>Enter your 6-digit PIN</Text>
        <View style={s.dots}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[s.dot, { backgroundColor: i < pinInput.length ? C.darkPine : 'transparent', borderColor: errorMessage != null ? C.error : C.darkPine }]}
            />
          ))}
        </View>
        {errorMessage != null ? <Text style={s.error}>{errorMessage}</Text> : null}
      </View>

      <View style={{ alignSelf: 'stretch', gap: 10 }}>
        {PAD_ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: 12 }}>
            {row.map((key) => {
              const action = key === 'C' || key === 'X';
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === 'C' ? 'Clear' : key === 'X' ? 'Backspace' : key}
                  onPress={() => press(key)}
                  style={({ pressed }) => [s.key, action ? s.keyAction : s.keyDigit, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ fontSize: action ? 15 : 24, fontWeight: '700', color: action ? alpha(C.darkPine, 0.7) : C.darkPine }}>{key === 'C' ? 'Clear' : key === 'X' ? '⌫' : key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={onCancel} style={s.cancel}>
        <Text style={{ color: C.darkPine, fontSize: 13, fontWeight: '700' }}>Cancel sign-in</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: 20, padding: 20, width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'center' },
  greeting: { alignSelf: 'stretch', padding: 18, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.goldAmber, alignItems: 'center', justifyContent: 'center' },
  verified: { fontSize: 10, fontWeight: '700', color: C.goldAmber, letterSpacing: 1 },
  name: { fontSize: 20, fontWeight: '900', color: C.white },
  uid: { fontSize: 11, color: alpha(C.white, 0.8) },
  prompt: { fontSize: 23, fontWeight: '900', color: C.darkPine, textAlign: 'center', letterSpacing: 0.5 },
  dots: { flexDirection: 'row', gap: 14, marginTop: 16, alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  error: { color: C.error, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  key: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  keyDigit: { backgroundColor: C.white, borderWidth: 1, borderColor: C.warmGray },
  keyAction: { backgroundColor: C.iceMint },
  cancel: { alignSelf: 'stretch', height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
