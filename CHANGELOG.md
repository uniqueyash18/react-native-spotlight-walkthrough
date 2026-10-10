# Changelog

## 0.1.2

Bug fixes.

- Narration is no longer cut off when the target is re-measured (rotation, layout shifts, scroll end). It now stops only when the step changes or the tour ends.
- Calling `start()` on the tour that is already showing, at the same step, no longer leaves a blank overlay that blocks touches.
- `stop()` and `skip()` cancel a tour that is waiting on `start(..., { delay })`.
- A swipe across the backdrop no longer counts as a press for `backdropPress`.
- `onEnter`, `onStepChange` and narration receive the current step, including patches made with `updateStep` while it was measuring.
- Two quick `start()` calls can no longer both begin a `showOnce` tour.
- The `expo-audio` adapter no longer reports a failed clip twice. A failed clip rejects `play` and reaches `onAudioError`; the adapter's own `onError` is now for audio-session and player errors only.
- Peer ranges for `expo-audio` (`>=0.3.0`) and `expo-speech` (`>=13.0.0`) are now bounded instead of `*`.

## 0.1.1

- Docs: Expo vs bare React Native support, bare setup (Babel plugin, Xcode 27 Podfile fix), and narration adapters built on `react-native-sound` and `react-native-tts`.

## 0.1.0

First release.

- `WalkthroughProvider`, `WalkthroughTarget` / `useWalkthroughTarget` and `useWalkthrough`.
- Spotlight shapes: `rect`, `pill`, `circle` and `none`. The hole morphs between steps and has a pulsing ring.
- Interactive steps: the hole passes touches through to the real UI.
- Gesture simulation presets (tap, double tap, long press, swipe, pinch), plus the primitives they are built from.
- Narration with four modes (`auto`, `audio`, `tts`, `off`), set on the provider, per step, or at runtime with `setNarration`. In `auto`, TTS reads the step when it has no audio file or the file fails.
- `expo-audio` and `expo-speech` adapters, a mute toggle, and `onAudioError`.
- `showOnce` tours with pluggable storage.
- Targets scroll into view before they're spotlighted, through `WalkthroughScrollView`, `WalkthroughScrollContainer` or a `scrollRef`. Nested scroll views work, and the tour waits for the target to stop moving before drawing the spotlight.
- The spotlight follows its target through layout shifts and user scrolling.
- Deep-mergeable theme, per-step theme overrides, `renderTooltip` and `renderHand`.
