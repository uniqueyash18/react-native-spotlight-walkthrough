# Changelog

## Unreleased

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
