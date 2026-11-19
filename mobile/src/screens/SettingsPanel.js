import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { api, configure } from '../api';
import { saveSettings, cleanBaseUrl } from '../config';
import { Banner, Button, Card, Field, s } from '../components';
import { C } from '../theme';

/** Server address + device key. Lets the app be pointed at a different server without rebuilding. */
export default function SettingsPanel({ settings, onSaved, onClose }) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [kioskKey, setKioskKey] = useState(settings.kioskKey);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    const url = cleanBaseUrl(baseUrl);
    if (!/^https?:\/\/.+/i.test(url)) { setMsg({ kind: 'error', text: 'Enter the address starting with http:// or https://' }); return; }
    setBusy(true); setMsg(null);
    const next = await saveSettings({ baseUrl: url, kioskKey });
    configure(next);
    try {
      await api.health();
      setMsg({ kind: 'info', text: 'Connected. Settings saved.' });
      onSaved(next);
    } catch (error) {
      onSaved(next);
      setMsg({ kind: 'error', text: `Saved, but the test failed: ${error.message}` });
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <Text style={[s.sectionTitle, { fontSize: 18, marginBottom: 12 }]}>Server settings</Text>
      <Banner kind={msg?.kind}>{msg?.text}</Banner>
      <Field label="Server address" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false}
        keyboardType="url" placeholder="http://192.168.1.10:3000" />
      <Field label="Kiosk key (KIOSK_API_KEY)" value={kioskKey} onChangeText={setKioskKey} autoCapitalize="none" autoCorrect={false}
        secureTextEntry placeholder="Same value as in the server's .env" />
      <Text style={{ color: C.muted, fontSize: 10, lineHeight: 15, marginBottom: 14 }}>
        Emulator: http://10.0.2.2:3000. Phone on the same Wi-Fi: http://your-PC-IP:3000 (set API_HOST=0.0.0.0 on the server).
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button loading={busy} onPress={save} style={{ flex: 1 }}>Save and test</Button>
        {onClose ? <Button kind="outline" onPress={onClose} style={{ flex: 1 }}>Close</Button> : null}
      </View>
    </Card>
  );
}
