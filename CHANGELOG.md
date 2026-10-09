# Changelog

## 0.1.0

First release.

- `WalkthroughProvider`, `WalkthroughTarget` / `useWalkthroughTarget` and `useWalkthrough`.
- Spotlight shapes: `rect`, `pill`, `circle` and `none`. The hole morphs between steps and has a pulsing ring.
- Interactive steps: the hole passes touches through to the real UI.
- Gesture simulation presets (tap, double tap, long press, swipe, pinch), plus the primitives they are built from.
- Per-step audio through adapters, an `expo-audio` adapter and a mute toggle.
- `showOnce` tours with pluggable storage.
- Deep-mergeable theme, per-step theme overrides, `renderTooltip` and `renderHand`.
