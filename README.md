# react-native-spotlight-walkthrough

Interactive spotlight walkthroughs for React Native.

- **Interactive steps.** The spotlight hole can pass touches through, so users try the real gesture instead of only reading about it. Your code moves the tour forward when they do.
- **Gesture simulations.** An animated hand demonstrates tap, double tap, long press, swipe or pinch on the target. You can also build your own from the same primitives.
- **Per-step audio.** Each step can play a voice-over through a pluggable adapter. An `expo-audio` adapter is included, and the tooltip has a mute toggle.
- **Show once.** A tour can remember it has been seen, using any storage (AsyncStorage, MMKV, expo-secure-store and so on).
- **Fully themeable.** You can change the overlay colour and opacity, the hole shape (`rect`, `pill`, `circle`, `none`), padding, radius, ring, pulse and morph timing. The tooltip, text, buttons, progress dots, arrow, hand and ripple are all themeable. You can override the theme per step, or replace the tooltip or hand completely.
- **Built with** Reanimated and react-native-svg. It works in RTL layouts and respects safe areas.

## Install

```sh
npm install react-native-spotlight-walkthrough
# peer dependencies (most apps already have them)
npm install react-native-reanimated react-native-svg react-native-safe-area-context
# optional, for step audio
npx expo install expo-audio
```

## Quick start

Wrap your app once, inside `SafeAreaProvider`:

```tsx
import { WalkthroughProvider } from 'react-native-spotlight-walkthrough';

export default function App() {
  return (
    <SafeAreaProvider>
      <WalkthroughProvider theme={{ accentColor: '#BC4E2C' }}>
        <Navigation />
      </WalkthroughProvider>
    </SafeAreaProvider>
  );
}
```

Mark what you want to spotlight, then start a tour:

```tsx
import {
  WalkthroughTarget,
  useWalkthrough,
  type WalkthroughTour,
} from 'react-native-spotlight-walkthrough';

const homeTour: WalkthroughTour = {
  id: 'home-v1',
  showOnce: true,
  steps: [
    {
      id: 'search',
      target: 'search-bar',
      title: 'Search anything',
      message: 'Find parts by name, number or VIN.',
      shape: 'pill',
    },
    {
      id: 'cart',
      target: 'cart-button',
      title: 'Your cart',
      message: 'Everything you add lands here.',
      shape: 'circle',
      simulation: { type: 'tap' },
    },
  ],
};

function HomeScreen() {
  const walkthrough = useWalkthrough();

  useEffect(() => {
    walkthrough.start(homeTour, { delay: 500 });
  }, []);

  return (
    <>
      <WalkthroughTarget id="search-bar">
        <SearchBar />
      </WalkthroughTarget>
      <WalkthroughTarget id="cart-button">
        <CartButton />
      </WalkthroughTarget>
    </>
  );
}
```

`useWalkthroughTarget(id)` returns a ref instead, so you can attach it to an existing `View` without adding a wrapper. Remember to set `collapsable={false}` on that view.

## Interactive steps

Set `interactive: true` and touches inside the hole reach your real UI. Touches everywhere else are still blocked. Move the tour forward from your own handlers:

```tsx
const tour: WalkthroughTour = {
  id: 'explorer',
  steps: [
    {
      id: 'highlight',
      target: 'model',
      title: 'Tap once to highlight a part',
      hint: 'Try it: tap a part on the car',
      interactive: true,
      simulation: { type: 'tap', at: { x: 0.5, y: 0.56 } },
    },
    {
      id: 'confirm',
      target: 'model',
      title: 'Tap again to select it',
      interactive: true,
      simulation: { type: 'doubleTap' },
    },
    {
      id: 'done',
      title: 'All set!',
      message: 'Pick Inner or Outer parts next.',
    }, // no target, so this shows as a centred card
  ],
};

function Explorer() {
  const wt = useWalkthrough();

  const onPartSelected = (part: Part) => {
    if (wt.currentStep?.id === 'highlight') {
      // Put what the user actually tapped into the next step's text.
      wt.updateStep('confirm', { message: `Nice! ${part.name} is highlighted. Tap it again.` });
      wt.next();
    }
  };
  // ...
}
```

## Gesture simulations

`simulation` takes one of three forms:

| Form | Example |
| --- | --- |
| A preset | `{ type: 'tap' \| 'doubleTap' \| 'longPress' \| 'pinch', at?: { x, y }, duration? }` or `{ type: 'swipe', from?, to?, duration? }` (points are fractions 0–1 of the hole) |
| A render function | `({ width, height, theme }) => <MyAnimation width={width} />` |
| Any element | `<MyAnimation />` |

Build custom simulations from the same primitives the presets use. Each element reads one looping clock, so they stay in sync:

```tsx
import {
  useLoopProgress,
  SimHand,
  TapRipple,
  tapPressScale,
} from 'react-native-spotlight-walkthrough';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

function TapAndReveal({ width, height }: { width: number; height: number }) {
  const t = useLoopProgress(2800);
  const x = width / 2;
  const y = height / 2;

  const hand = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.12, 0.5, 0.6], [0, 1, 1, 0], 'clamp'),
    transform: [{ scale: tapPressScale(t.value, 0.25) }],
  }));
  const chip = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.3, 0.38, 0.85, 0.95], [0, 1, 1, 0], 'clamp'),
  }));

  return (
    <>
      <Animated.View style={[{ position: 'absolute', top: y - 60, alignSelf: 'center' }, chip]}>
        <PartChip label="Front Bumper" />
      </Animated.View>
      <TapRipple progress={t} x={x} y={y} at={0.25} />
      <SimHand x={x} y={y} style={hand} />
    </>
  );
}

// step: { simulation: ({ width, height }) => <TapAndReveal width={width} height={height} /> }
```

> Worklets can't call JS-thread functions. Work out values such as `moderateScale(36)` outside `useAnimatedStyle` and capture the result.

To replace the hand everywhere (with an icon font glyph, an image or a Lottie animation), pass `renderHand`:

```tsx
<WalkthroughProvider
  renderHand={({ size, fillColor }) => (
    <MaterialCommunityIcons name="hand-pointing-up" size={size} color={fillColor} />
  )}
>
```

The fingertip is expected near the top of the glyph, about 46% across.

## Audio

```tsx
import { createExpoAudioAdapter } from 'react-native-spotlight-walkthrough/expo-audio';

const audio = createExpoAudioAdapter({ volume: 1, playsInSilentMode: true });

<WalkthroughProvider audio={audio}>

// per step
{ id: 'intro', title: 'Welcome', audio: require('./assets/walkthrough/intro.m4a') }
{ id: 'remote', title: 'Map', audio: { uri: 'https://cdn.example.com/map.m4a' } }
```

Audio starts when a step appears and stops when the step changes or the tour ends. While a step has audio, the tooltip shows a mute toggle. Hide it with `theme.audio.showMuteButton: false`. To control muting yourself, use `useWalkthrough().muted` and `setMuted`.

To use any other player, implement `{ play(source), stop() }`:

```ts
const audio: WalkthroughAudioAdapter = {
  play: (source) => TrackPlayer.load(source).then(() => TrackPlayer.play()),
  stop: () => TrackPlayer.pause(),
};
```

## Show once

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
// or: import * as SecureStore from 'expo-secure-store'
//     storage={{ getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync }}

<WalkthroughProvider storage={AsyncStorage} storageKeyPrefix="myapp_tour_">
```

| Call | Result |
| --- | --- |
| `start(tour)` | Resolves `false` and shows nothing if `tour.showOnce` is set and the tour was already seen |
| `start(tour, { force: true })` | Ignores the seen flag (use it for a "Replay tour" button) |
| `skip()` | Marks the tour as seen |
| Finishing the last step | Marks the tour as seen |
| `stop()` | Does not mark the tour as seen |
| `hasSeen(id)`, `markSeen(id)`, `resetSeen(id)` | Manual control of the flag |

Bump the tour `id` (for example `home-v2`) to show a changed tour to everyone again. For per-user tours, put the user id in the tour id.

## Theming

Everything comes from a theme. It is deep-merged over `defaultTheme`, and `step.theme` is merged over that for a single step.

```tsx
<WalkthroughProvider
  theme={{
    accentColor: '#BC4E2C',              // ring, dots, Next button, hint
    overlay: { color: '#120402', opacity: 0.75, fadeDuration: 250 },
    spotlight: {
      shape: 'rect',                     // 'rect' | 'pill' | 'circle' | 'none'
      padding: 8,
      borderRadius: 18,
      transitionDuration: 350,           // the hole morphs between steps; 0 = jump
      ring: { show: true, color: '#FFD08A', width: 3, pulse: true, pulseDuration: 1100 },
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      marginHorizontal: 20,
      offset: 14,                        // gap between hole and tooltip
      maxWidth: 420,                     // tablets
      arrow: { show: true, size: 10 },
      style: { borderWidth: 1, borderColor: '#F9EFEB' },
    },
    text: {
      title: { fontFamily: 'Inter-Bold', fontSize: 17, color: '#1C0A03' },
      message: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#73544A' },
      stepCounter: { fontFamily: 'Inter-Medium' },
      hint: { fontFamily: 'Inter-SemiBold' },
    },
    buttons: {
      next: { borderRadius: 12, paddingHorizontal: 24 },
      nextText: { fontFamily: 'Inter-Bold' },
      skipText: { color: '#73544A' },
    },
    progress: { showDots: true, showCounter: true, dotColor: '#EADBD5', activeDotWidth: 18 },
    hand: { show: true, size: 46, fillColor: '#FFFFFF', strokeColor: '#1C0A03' },
    ripple: { color: '#FFFFFF', size: 56, width: 3 },
    audio: { showMuteButton: true, iconColor: '#73544A' },
  }}
  labels={{
    next: t('NEXT'),
    back: t('BACK'),
    skip: t('SKIP'),
    done: t('GOT_IT'),
    stepCounter: (current, total) => t('STEP_COUNT', { current, total }),
  }}
>
```

### Custom tooltip

To restructure the tooltip completely, pass `renderTooltip` on the provider (all steps) or on one step. It receives the step, its position in the tour, the theme, the labels, the audio state and `next` / `back` / `skip` / `stop` / `toggleMute`:

```tsx
<WalkthroughProvider
  renderTooltip={({ step, stepIndex, totalSteps, isLast, next, skip }) => (
    <MyCard>
      <MyCard.Title>{step.title}</MyCard.Title>
      <MyCard.Body>{step.message}</MyCard.Body>
      {step.content}
      <MyButton onPress={next}>{isLast ? 'Finish' : `Next (${stepIndex + 1}/${totalSteps})`}</MyButton>
    </MyCard>
  )}
>
```

The overlay still positions your tooltip and draws its arrow, using `tooltip.backgroundColor`. Set `tooltip.arrow.show: false` if your card looks different.

Use `step.content` to add something inside the default tooltip. A mock of the sheet the user will see next works well here, and it can run its own simulation.

## API

### `<WalkthroughProvider>`

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `theme` | `DeepPartial<WalkthroughTheme>` | `defaultTheme` | See Theming |
| `labels` | `Partial<WalkthroughLabels>` | English | Button and counter text |
| `audio` | `WalkthroughAudioAdapter` | none | Plays `step.audio` |
| `initiallyMuted` | `boolean` | `false` | |
| `storage` | `WalkthroughStorage` | none | Needed for `showOnce` |
| `storageKeyPrefix` | `string` | `'walkthrough_seen_'` | |
| `renderTooltip` | `(props) => ReactNode` | `DefaultTooltip` | |
| `renderHand` | `(props) => ReactNode` | SVG hand | |
| `overlayHost` | `'root' \| 'modal'` | `'root'` | `'modal'` covers native modals but can't pass touches through |
| `insets` | `Insets` | from safe-area-context | |
| `androidBack` | `'skip' \| 'back' \| 'stop' \| 'none'` | `'skip'` | Hardware back button |
| `measureTimeout` | `number` (ms) | `2000` | How long to retry a target that isn't mounted yet |
| `onStart` / `onStepChange` / `onFinish` | callbacks | | `onFinish(tourId, 'completed' \| 'skipped' \| 'stopped')` |

### `WalkthroughStep`

| Field | Type | |
| --- | --- | --- |
| `id` | `string` | Required |
| `target` | `string \| Rect \| () => Rect \| null \| Promise<…>` | A target id, a fixed window rect, or a resolver. Omit it for a centred card |
| `title`, `message`, `hint` | `string` | |
| `content` | `ReactNode` | Extra tooltip content |
| `renderTooltip` | `(props) => ReactNode` | Replaces the tooltip for this step |
| `shape`, `padding`, `borderRadius` | | Override the theme's spotlight settings |
| `placement` | `'auto' \| 'top' \| 'bottom' \| 'center'` | `auto` picks the side with more room. If neither side has room, the tooltip is centred |
| `interactive` | `boolean` | Touches inside the hole reach the real UI |
| `simulation` | `StepSimulation` | |
| `audio` | any | Passed to `audio.play` |
| `showSkip`, `showBack`, `showNext`, `nextLabel` | | Skip is shown on every step except the last by default. Back is hidden by default |
| `backdropPress` | `'none' \| 'next' \| 'skip' \| 'stop'` | What a tap on the dimmed area does. Default `none` |
| `theme` | `DeepPartial<WalkthroughTheme>` | Theme override for this step |
| `onBeforeEnter` | `() => void \| Promise<void>` | Awaited before the target is measured. Use it to scroll the target into view |
| `onEnter`, `onExit` | `() => void` | |

### `useWalkthrough()`

`start(tour, { force?, startAt?, delay? })`, `next()`, `back()`, `goTo(idOrIndex)`, `skip()`, `stop()`, `updateStep(id, patch)`, `refresh()` (re-measures the target), `isActive`, `tourId`, `currentStep`, `stepIndex`, `totalSteps`, `muted`, `setMuted`, `hasSeen`, `markSeen`, `resetSeen`.

## Notes

- **Measuring targets.** Targets are measured with `measureInWindow`. If a target is inside a `ScrollView`, scroll it into view in `onBeforeEnter`. You can also turn scrolling off while the tour runs (`scrollEnabled={!isActive}`). Call `refresh()` after a layout change the library can't see.
- **Where the overlay is drawn.** It is drawn above the provider's children. Native modals (`<Modal>`, native-stack modal presentations) are drawn above it. For a tour inside those, either wrap the modal's content in its own `WalkthroughProvider` or use `overlayHost="modal"`.
- **Non-rectangular holes.** For `circle` and `pill` holes, touches only pass through within the hole's bounding box.
- **WebViews.** WebViews and other native views work as interactive targets, because the hole has no view over it.

## License

MIT
