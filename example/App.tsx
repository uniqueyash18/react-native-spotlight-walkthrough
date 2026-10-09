import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  WalkthroughProvider,
  WalkthroughScrollView,
  WalkthroughTarget,
  useWalkthrough,
  type NarrationMode,
  type WalkthroughStorage,
  type WalkthroughTour,
} from 'react-native-spotlight-walkthrough';
import { createExpoAudioAdapter } from 'react-native-spotlight-walkthrough/expo-audio';
import { createExpoSpeechAdapter } from 'react-native-spotlight-walkthrough/expo-speech';

// Set EXPO_PUBLIC_AUTOPLAY=1 to step through the tour on a timer (used to
// record the README screenshots).
const AUTOPLAY = process.env.EXPO_PUBLIC_AUTOPLAY === '1';

const ACCENT = '#BC4E2C';
const chime = require('./assets/chime.wav');

// In-memory "seen" flags so the tour shows on every launch of the example.
// In an app, pass AsyncStorage / MMKV / expo-secure-store instead.
const memory = new Map<string, string>();
const storage: WalkthroughStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
  removeItem: (key) => void memory.delete(key),
};

const CATEGORIES = ['Brakes', 'Filters', 'Lighting', 'Suspension', 'Engine', 'Cooling', 'Exhaust', 'Wipers', 'Batteries', 'Tyres'];
const PRODUCTS = [
  { name: 'Ceramic brake pads', price: '$48' },
  { name: 'Cabin air filter', price: '$19' },
  { name: 'LED headlight bulbs', price: '$64' },
  { name: 'Front shock absorber', price: '$112' },
  { name: 'Spark plug set', price: '$36' },
  { name: 'Radiator hose', price: '$27' },
  { name: 'Wiper blades (pair)', price: '$22' },
  { name: '12V AGM battery', price: '$189' },
];

function PartTypeSheet() {
  return (
    <View style={styles.sheet}>
      {[
        { label: 'Inner parts', hint: 'Internal components & mechanisms' },
        { label: 'Outer parts', hint: 'External body & trim' },
      ].map((row) => (
        <View key={row.label} style={styles.sheetRow}>
          <Text style={styles.sheetLabel}>{row.label}</Text>
          <Text style={styles.sheetHint}>{row.hint}</Text>
        </View>
      ))}
    </View>
  );
}

const tour: WalkthroughTour = {
  id: 'example-shop',
  showOnce: true,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to the parts shop',
      message: 'A quick tour of the screen — about thirty seconds.',
      audio: chime,
    },
    {
      id: 'profile',
      target: 'profile',
      shape: 'circle',
      title: 'Your garage',
      message: 'Saved vehicles, orders and settings live here.',
      simulation: { type: 'tap' },
    },
    {
      id: 'search',
      target: 'search',
      shape: 'pill',
      title: 'Search anything',
      message: 'Find parts by name, part number or VIN.',
      simulation: { type: 'swipe' },
      showBack: true,
    },
    {
      id: 'model',
      target: 'model',
      title: 'Tap a part on the car',
      message: 'This one is real — tap the car to keep going.',
      hint: 'Try it — tap the car',
      interactive: true,
      simulation: { type: 'doubleTap' },
    },
    {
      id: 'part-type',
      target: 'model',
      title: 'Inner or outer?',
      message: 'Pick the kind of part you need and we show what fits.',
      content: <PartTypeSheet />,
      speak: 'Pick inner or outer parts, and we show what fits your car.',
    },
    {
      id: 'categories',
      target: 'category-Batteries',
      shape: 'pill',
      title: 'Browse by category',
      message: 'Off-screen targets are scrolled into view — sideways too.',
    },
    {
      id: 'deal',
      target: 'deal',
      title: 'Deal of the day',
      message: 'This card starts far below the fold; the list scrolls to it.',
      simulation: { type: 'longPress' },
    },
    {
      id: 'cart',
      target: 'cart',
      title: 'Your cart',
      message: 'Check out when you are ready. Tap anywhere to finish.',
      backdropPress: 'next',
    },
  ],
};

const MODES: NarrationMode[] = ['auto', 'audio', 'tts', 'off'];

function ShopScreen() {
  const wt = useWalkthrough();
  const [carTaps, setCarTaps] = useState(0);

  useEffect(() => {
    wt.start(tour, { delay: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!AUTOPLAY || !wt.isActive) return;
    const timer = setTimeout(wt.next, wt.currentStep?.interactive ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [wt.isActive, wt.currentStep, wt.next]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <WalkthroughScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Good morning</Text>
            <Text style={styles.h1}>Parts shop</Text>
          </View>
          <View style={styles.headerEnd}>
            <Pressable
              style={styles.replay}
              onPress={() => wt.start(tour, { force: true })}
              accessibilityLabel="Replay tour"
            >
              <Text style={styles.replayText}>?</Text>
            </Pressable>
            <WalkthroughTarget id="profile" style={styles.avatar}>
              <Text style={styles.avatarText}>YC</Text>
            </WalkthroughTarget>
          </View>
        </View>

        <WalkthroughTarget id="search" style={styles.search}>
          <Text style={styles.searchText}>Search parts, part numbers, VIN…</Text>
        </WalkthroughTarget>

        <WalkthroughTarget id="model">
          <Pressable
            style={styles.model}
            onPress={() => {
              setCarTaps((n) => n + 1);
              if (wt.currentStep?.id === 'model') wt.next();
            }}
          >
            <Text style={styles.modelEmoji}>🚗</Text>
            <Text style={styles.modelTitle}>Toyota Corolla · 2021</Text>
            <Text style={styles.modelHint}>Tap a part to explore · taps: {carTaps}</Text>
          </Pressable>
        </WalkthroughTarget>

        <View style={styles.modes}>
          <Text style={styles.modesLabel}>Narration</Text>
          <View style={styles.modesRow}>
            {MODES.map((mode) => (
              <Pressable
                key={mode}
                onPress={() => wt.setNarration(mode)}
                style={[styles.mode, wt.narration === mode && styles.modeActive]}
              >
                <Text style={[styles.modeText, wt.narration === mode && styles.modeTextActive]}>{mode}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Categories</Text>
        <WalkthroughScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => (
            <WalkthroughTarget key={c} id={`category-${c}`} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </WalkthroughTarget>
          ))}
        </WalkthroughScrollView>

        <Text style={styles.sectionTitle}>Popular parts</Text>
        {PRODUCTS.map((p) => (
          <View key={p.name} style={styles.product}>
            <View style={styles.productThumb} />
            <Text style={styles.productName}>{p.name}</Text>
            <Text style={styles.productPrice}>{p.price}</Text>
          </View>
        ))}

        <WalkthroughTarget id="deal" style={styles.deal}>
          <Text style={styles.dealKicker}>DEAL OF THE DAY</Text>
          <Text style={styles.dealTitle}>Full brake service kit</Text>
          <Text style={styles.dealPrice}>$129 <Text style={styles.dealWas}>$179</Text></Text>
        </WalkthroughTarget>
      </WalkthroughScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <WalkthroughTarget id="cart" style={styles.cart}>
          <Text style={styles.cartText}>View cart · 2 items</Text>
        </WalkthroughTarget>
      </SafeAreaView>
    </SafeAreaView>
  );
}

export default function App() {
  const audio = useMemo(() => createExpoAudioAdapter(), []);
  const speech = useMemo(() => createExpoSpeechAdapter({ rate: 0.95 }), []);
  return (
    <SafeAreaProvider>
      <WalkthroughProvider
        theme={{ accentColor: ACCENT, tooltip: { maxWidth: 440 } }}
        audio={audio}
        speech={speech}
        speechLanguage="en-US"
        storage={storage}
      >
        <ShopScreen />
        <StatusBar style="dark" />
      </WalkthroughProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF6F4' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kicker: { color: '#73544A', fontSize: 13 },
  h1: { fontSize: 26, fontWeight: '800', color: '#1C0A03' },
  replay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EADBD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayText: { color: ACCENT, fontWeight: '800', fontSize: 16 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  search: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  searchText: { color: '#9CA3AF' },
  model: {
    height: 210,
    borderRadius: 20,
    backgroundColor: '#FEECE8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modelEmoji: { fontSize: 64 },
  modelTitle: { fontSize: 18, fontWeight: '700', color: '#1C0A03' },
  modelHint: { color: '#73544A', fontSize: 13 },
  modes: { gap: 8 },
  modesLabel: { color: '#73544A', fontSize: 13, fontWeight: '600' },
  modesRow: { flexDirection: 'row', backgroundColor: '#F9EFEB', borderRadius: 12, padding: 4, gap: 4 },
  mode: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  modeActive: { backgroundColor: ACCENT },
  modeText: { color: '#73544A', fontWeight: '600' },
  modeTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1C0A03', marginTop: 4 },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  chipText: { fontWeight: '600', color: ACCENT },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
  },
  productThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F9EFEB' },
  productName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1C0A03' },
  productPrice: { fontSize: 15, fontWeight: '700', color: ACCENT },
  deal: { borderRadius: 20, backgroundColor: '#1C0A03', padding: 20, gap: 4 },
  dealKicker: { color: '#F5B8A5', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  dealTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  dealPrice: { color: '#fff', fontSize: 18, fontWeight: '800' },
  dealWas: { color: '#9C8C86', fontSize: 14, fontWeight: '500', textDecorationLine: 'line-through' },
  footer: { backgroundColor: '#FFF6F4', paddingHorizontal: 20, paddingTop: 8 },
  cart: {
    height: 54,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cartText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sheet: { marginTop: 12, gap: 8 },
  sheetRow: { borderRadius: 12, backgroundColor: '#FFF6F4', borderWidth: 1, borderColor: '#F9EFEB', padding: 12 },
  sheetLabel: { fontWeight: '700', color: '#1C0A03' },
  sheetHint: { color: '#73544A', fontSize: 12, marginTop: 2 },
});
