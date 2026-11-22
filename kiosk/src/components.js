// Port of ui/components/CommonComponents.kt plus the small Compose pieces the screens share (Card, Button, OutlinedButton).
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { alpha, C } from './theme';
import { AppMode } from './controller';

/** Compose Card: rounded surface with an optional border and elevation. */
export function Card({ children, style, radius = 20, color = C.cardBg, border, elevation = 0, onPress }) {
  const base = [
    { borderRadius: radius, backgroundColor: color, elevation },
    border || color === C.cardBg ? { borderWidth: border?.width ?? 1, borderColor: border?.color ?? C.warmGray } : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && s.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

/** Filled button (Compose Button). `color` is the container color; text is white unless `textColor` is given. */
export function Button({ title, onPress, disabled = false, color = C.darkPine, textColor = C.white, radius = 16, height = 48, fontSize = 14, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button, { backgroundColor: color, borderRadius: radius, height }, disabled && s.disabled, pressed && !disabled && s.pressed, style,
      ]}
    >
      <Text style={{ color: textColor, fontSize, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

/** Outlined button (Compose OutlinedButton). */
export function OutlinedButton({ title, onPress, textColor = C.darkPine, borderColor = C.warmGray, radius = 14, height = 48, fontSize = 13, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.button, { borderRadius: radius, height, borderWidth: 1, borderColor }, pressed && s.pressed, style,
      ]}
    >
      <Text style={{ color: textColor, fontSize, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function Hero({ children, style }) {
  return (
    <View style={[s.hero, style]}>
      <View pointerEvents="none" style={s.heroRing} />
      {children}
    </View>
  );
}

/** Dark green summary card used at the top of the screens (eyebrow, title, subtitle). */
export function HeaderCard({ eyebrow, title, subtitle, right }) {
  return (
    <Hero style={s.headerCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </Hero>
  );
}

/** KioskHeader: brand bar with Exit / Back. `topInset` is the status-bar height (Compose statusBarsPadding). */
export function KioskHeader({ currentMode, user, onLogout, topInset = 0 }) {
  const showExit = user != null && currentMode !== AppMode.NFC_SCAN && currentMode !== AppMode.PIN_ENTRY;
  const showBack = !showExit && currentMode !== AppMode.NFC_SCAN;
  return (
    <View style={[s.header, { paddingTop: topInset + 12 }]}>
      <View style={s.headerLeft}>
        <Image source={require('../assets/eco-tap-logo.png')} style={s.logo} resizeMode="contain" />
        <View style={{ marginLeft: 10, flexShrink: 1 }}>

          <Text style={s.brand}>ECO-TAP</Text>
          <Text style={s.brandSub}>Quezon City · Barangay Central</Text>
        </View>
      </View>
      {showExit ? (
        <Pressable accessibilityRole="button" onPress={() => onLogout()} style={[s.exit, { backgroundColor: C.iceMint }]}>
          <Text style={{ color: C.darkPine, fontSize: 12, fontWeight: '900' }}>← Exit</Text>
        </Pressable>
      ) : null}
      {showBack ? (
        <Pressable accessibilityRole="button" onPress={() => onLogout()} style={[s.exit, { borderWidth: 1, borderColor: C.warmGray }]}>
          <Text style={{ color: C.darkPine, fontSize: 11, fontWeight: '700' }}>← Back</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** BannerNotification: dismissable message strip (the ViewModel clears it after 10 seconds). */
export function BannerNotification({ message, onDismiss }) {
  if (message == null) return null;
  return (
    <View style={s.banner} accessibilityLiveRegion="polite">

      <Text style={s.bannerText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={s.dismiss}>
        <Text style={{ color: C.white, fontSize: 11, fontWeight: '700' }}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

/** MetricCard (kept from CommonComponents.kt; the Kotlin screens do not currently use it). */
export function MetricCard({ title, value, subtitle, icon, style }) {
  return (
    <Card radius={18} elevation={2} border={{ color: alpha(C.darkPine, 0.1) }} style={[{ padding: 16 }, style]}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: alpha(C.deepNavy, 0.6), letterSpacing: 0.8 }}>{title.toUpperCase()}</Text>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.darkPine, marginTop: 8 }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '500', color: alpha(C.deepNavy, 0.75), marginTop: 2 }}>{subtitle}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  hero: { backgroundColor: C.darkPine, borderRadius: 25, padding: 22, overflow: 'hidden' },
  heroRing: { position: 'absolute', width: 175, height: 175, right: -42, top: -48, borderRadius: 90, borderWidth: 28, borderColor: C.sageGreen },
  headerCard: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, fontWeight: '700', color: C.goldAmber, letterSpacing: 0.5 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: C.white },
  headerSub: { fontSize: 12, color: alpha(C.white, 0.85) },
  header: {
    backgroundColor: C.surfaceBg, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.warmGray,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 52, height: 52 },
  brand: { color: C.darkPine, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  brandSub: { color: C.textMuted, fontSize: 12 },
  exit: { minHeight: 44, borderRadius: 16, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  banner: {
    marginHorizontal: 16, marginVertical: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.iceMint, borderWidth: 1, borderColor: C.warmGray, elevation: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bannerText: { flex: 1, color: C.darkPine, fontWeight: '600', fontSize: 12 },
  dismiss: { backgroundColor: C.darkPine, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10 },
});
