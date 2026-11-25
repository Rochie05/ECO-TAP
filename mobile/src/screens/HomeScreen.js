import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Loading, SectionTitle, StationCard } from '../components';
import { C } from '../theme';

export default function HomeScreen({ resident, deposits, stations, stationsError, goTo }) {
  const first = resident.fullName.split(' ')[0];
  return (
    <>
      <Heading eyebrow="SMALL ACTIONS, GREENER COMMUNITIES" title="Good to see you," accent={`${first}.`}
        intro="Your recycling journey is adding up. Keep going, one deposit at a time." />
      <View style={st.hero}>
        <View style={st.heroDecoration} />
        <Text style={st.heroLabel}>YOUR REWARD BALANCE</Text>
        <View style={st.pointsLine}><Text style={st.points}>{resident.ecoPoints}</Text><Text style={st.pointsUnit}>points</Text></View>
        <Text style={st.heroCopy}>Turn plastic into something positive.</Text>
        <Button kind="light" onPress={() => goTo('rewards')} style={{ alignSelf: 'flex-start', marginTop: 22 }}>Explore rewards</Button>
      </View>
      <View style={st.statGrid}>
        <Card style={st.statCard}><Text style={st.statIcon}>♻</Text><Text style={st.statValue}>{resident.totalWasteKg.toFixed(1)} kg</Text><Text style={st.statLabel}>Plastic collected</Text></Card>
        <Card style={st.statCard}><Text style={st.statIcon}>◎</Text><Text style={st.statValue}>{deposits.length}</Text><Text style={st.statLabel}>Recent deposits</Text></Card>
      </View>
      <SectionTitle eyebrow="GET STARTED" title="Make your next deposit" />
      <Card style={st.actionCard}>
        <View style={st.actionArt}><Text style={st.actionArtText}>♻</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={st.cardTitle}>Recycle & earn</Text>
          <Text style={st.cardCopy}>Tap your Eco-Card at a kiosk to deposit PET or HDPE bottles.</Text>
        </View>
      </Card>
      <SectionTitle eyebrow="COLLECTION NETWORK" title="Nearby kiosks" />
      {stations === null && !stationsError ? <Loading /> : null}
      {stationsError ? <Text style={st.cardCopy}>{stationsError}</Text> : null}
      {stations && stations.length === 0 ? <Text style={st.cardCopy}>No kiosks are set up yet.</Text> : null}
      {stations?.map((station) => <StationCard key={station.id} station={station} />)}
    </>
  );
}

export const st = StyleSheet.create({
  hero: { backgroundColor: C.forest, borderRadius: 25, minHeight: 226, padding: 25, overflow: 'hidden', marginBottom: 14 },
  heroDecoration: { position: 'absolute', right: -42, top: -38, width: 205, height: 205, borderRadius: 105, borderWidth: 35, borderColor: '#296445' },
  heroLabel: { color: '#BBD7BD', fontSize: 10, letterSpacing: 1.5, fontWeight: '900' },
  pointsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  points: { color: C.paper, fontSize: 61, fontWeight: '900', letterSpacing: -3, lineHeight: 67 },
  pointsUnit: { color: C.leaf, fontSize: 18, fontWeight: '800' },
  heroCopy: { color: '#E1ECE0', fontSize: 13 },
  statGrid: { flexDirection: 'row', gap: 11, marginBottom: 20 },
  statCard: { flex: 1, minHeight: 112, marginBottom: 0 },
  statIcon: { color: C.leaf, fontSize: 21, marginBottom: 7 },
  statValue: { color: C.forest, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 4 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  actionArt: { width: 55, height: 55, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  actionArtText: { color: C.forest, fontSize: 29 },
  cardTitle: { color: C.forest, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  cardCopy: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
