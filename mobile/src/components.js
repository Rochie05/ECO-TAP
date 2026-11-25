import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from './theme';

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ children, onPress, kind = 'primary', disabled = false, loading = false, style }) {
  const off = disabled || loading;
  return (
    <Pressable accessibilityRole="button" disabled={off} onPress={onPress}
      style={({ pressed }) => [s.button, kind === 'outline' && s.buttonOutline, kind === 'light' && s.buttonLight,
        kind === 'danger' && s.buttonDanger, off && s.disabled, pressed && !off && s.pressed, style]}>
      {loading
        ? <ActivityIndicator color={kind === 'primary' || kind === 'danger' ? C.paper : C.forest} />
        : <Text style={[s.buttonText, kind === 'outline' && s.buttonOutlineText, kind === 'light' && s.buttonLightText]}>{children}</Text>}
    </Pressable>
  );
}

export function Heading({ eyebrow, title, accent, intro }) {
  return (
    <View>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.pageTitle}>{title}{accent ? <Text style={s.accent}> {accent}</Text> : null}</Text>
      {intro ? <Text style={s.intro}>{intro}</Text> : null}
    </View>
  );
}

export function SectionTitle({ eyebrow, title, action, onAction }) {
  return (
    <View style={s.sectionHead}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {action ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={s.textLink}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Meter({ value }) {
  return <View style={s.meter}><View style={[s.meterFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} /></View>;
}

export function stationLabel(station) {
  if (station.fill >= 100) return 'Full';
  if (station.fill > 85) return 'Almost full';
  return station.status || 'Ready';
}

export function StationCard({ station }) {
  return (
    <View style={s.station}>
      <View style={s.stationIcon}><Text style={s.stationIconText}>♻</Text></View>
      <View style={{ flex: 1 }}>
        <View style={s.rowBetween}>
          <Text style={s.stationId}>{station.id}</Text>
          <Text style={[s.status, station.fill > 85 && s.statusWarm]}>{stationLabel(station)}</Text>
        </View>
        <Text style={s.stationName}>{station.name}</Text>
        <Meter value={station.fill} />
        <Text style={s.stationMeta}>{station.fill}% capacity</Text>
      </View>
    </View>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="#9AAA9E" style={[s.input, style]} {...props} />
    </View>
  );
}

export function Banner({ kind = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <Pressable onPress={onClose} disabled={!onClose} style={[s.banner, kind === 'error' && s.bannerError]}>
      <Text style={[s.bannerText, kind === 'error' && s.bannerErrorText]}>{children}</Text>
      {onClose ? <Text style={[s.bannerText, kind === 'error' && s.bannerErrorText]}>×</Text> : null}
    </Pressable>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={C.forest} />
      <Text style={{ color: C.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function formatDate(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTimestamp(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export const s = StyleSheet.create({
  eyebrow: { color: C.leaf, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 9 },
  pageTitle: { color: C.forest, fontSize: 38, lineHeight: 43, letterSpacing: -1.8, fontWeight: '900', maxWidth: 360 },
  accent: { color: C.leaf },
  intro: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 25 },
  card: { backgroundColor: C.pale, borderColor: C.line, borderWidth: 1, borderRadius: 19, padding: 18, marginBottom: 12 },
  button: { minHeight: 46, borderRadius: 30, backgroundColor: C.forest, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: C.paper, fontSize: 13, fontWeight: '800' },
  buttonLight: { backgroundColor: C.paper }, buttonLightText: { color: C.forest },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.forest }, buttonOutlineText: { color: C.forest },
  buttonDanger: { backgroundColor: C.danger },
  disabled: { opacity: 0.35 }, pressed: { opacity: 0.8 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 9, marginBottom: 13, gap: 10 },
  sectionTitle: { color: C.forest, fontSize: 22, fontWeight: '900', letterSpacing: -0.7 },
  textLink: { color: C.forest, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  meter: { height: 7, borderRadius: 7, backgroundColor: C.soft, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: C.leaf, borderRadius: 7 },
  station: { backgroundColor: C.pale, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', gap: 12, marginBottom: 11 },
  stationIcon: { width: 38, height: 38, backgroundColor: C.soft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stationIconText: { color: C.forest, fontSize: 23 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stationId: { color: C.forest, fontSize: 13, fontWeight: '900' },
  stationName: { color: C.muted, fontSize: 11, marginTop: 3, marginBottom: 9 },
  stationMeta: { color: C.muted, fontSize: 10, marginTop: 5 },
  status: { color: C.forest, backgroundColor: C.soft, fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  statusWarm: { backgroundColor: '#FFF0D9' },
  fieldLabel: { color: C.forest, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.pale, borderRadius: 13, minHeight: 48, paddingHorizontal: 14, color: C.forest, fontSize: 16 },
  banner: { backgroundColor: C.soft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  bannerText: { color: C.forest, fontSize: 12, fontWeight: '700', flexShrink: 1, lineHeight: 17 },
  bannerError: { backgroundColor: C.dangerSoft }, bannerErrorText: { color: C.danger },
});
