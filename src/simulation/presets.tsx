import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useWalkthroughTheme } from '../context';
import type { RelativePoint, SimulationPreset } from '../types';
import { SimHand, TapRipple, tapPressScale, useLoopProgress } from './primitives';

// Ready-made gesture simulations. Each one fills its parent (the spotlight
// hole) and loops for as long as it's mounted.

export interface PresetProps {
  width: number;
  height: number;
  duration?: number;
}

const CENTRE: RelativePoint = { x: 0.5, y: 0.5 };
const HAND_RISE = 36;

function toPoint(p: RelativePoint, width: number, height: number) {
  return { x: p.x * width, y: p.y * height };
}

// ─── Tap / double tap ────────────────────────────────────────────────────────

export function TapSimulation({
  width,
  height,
  at = CENTRE,
  duration = 2400,
  double = false,
}: PresetProps & { at?: RelativePoint; double?: boolean }) {
  const t = useLoopProgress(duration);
  const p = toPoint(at, width, height);
  const first = 0.28;
  const second = 0.42;

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.14, 0.62, 0.72], [0, 1, 1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(t.value, [0, 0.22], [HAND_RISE, 0], 'clamp') },
      {
        scale: double
          ? tapPressScale(t.value, first) * tapPressScale(t.value, second)
          : tapPressScale(t.value, first),
      },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <TapRipple progress={t} x={p.x} y={p.y} at={first} />
      {double && <TapRipple progress={t} x={p.x} y={p.y} at={second} />}
      <SimHand x={p.x} y={p.y} style={handStyle} />
    </View>
  );
}

// ─── Long press ──────────────────────────────────────────────────────────────

export function LongPressSimulation({
  width,
  height,
  at = CENTRE,
  duration = 2800,
}: PresetProps & { at?: RelativePoint }) {
  const theme = useWalkthroughTheme();
  const t = useLoopProgress(duration);
  const p = toPoint(at, width, height);
  const size = theme.ripple.size;
  const pressStart = 0.24;
  const pressEnd = 0.7;

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.14, 0.76, 0.86], [0, 1, 1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(t.value, [0, pressStart - 0.04], [HAND_RISE, 0], 'clamp') },
      {
        scale: interpolate(
          t.value,
          [pressStart - 0.04, pressStart, pressEnd, pressEnd + 0.05],
          [1, 0.84, 0.84, 1],
          'clamp',
        ),
      },
    ],
  }));
  // A disc that grows while the finger is held down.
  const holdStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [pressStart, pressStart + 0.04, pressEnd, pressEnd + 0.08],
      [0, 0.45, 0.45, 0],
      'clamp',
    ),
    transform: [{ scale: interpolate(t.value, [pressStart, pressEnd], [0.2, 1.3], 'clamp') }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.disc,
          {
            left: p.x - size / 2,
            top: p.y - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.ripple.color,
          },
          holdStyle,
        ]}
      />
      <TapRipple progress={t} x={p.x} y={p.y} at={pressEnd} />
      <SimHand x={p.x} y={p.y} style={handStyle} />
    </View>
  );
}

// ─── Swipe / drag ────────────────────────────────────────────────────────────

export function SwipeSimulation({
  width,
  height,
  from = { x: 0.28, y: 0.55 },
  to = { x: 0.72, y: 0.55 },
  duration = 2600,
}: PresetProps & { from?: RelativePoint; to?: RelativePoint }) {
  const theme = useWalkthroughTheme();
  const t = useLoopProgress(duration);
  const a = toPoint(from, width, height);
  const b = toPoint(to, width, height);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const angle = `${Math.atan2(dy, dx)}rad`;
  const trailWidth = theme.ripple.width + 1;

  const handStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.1, 0.6, 0.7], [0, 1, 1, 0], 'clamp'),
    transform: [
      { translateX: interpolate(t.value, [0.14, 0.56], [0, dx], 'clamp') },
      { translateY: interpolate(t.value, [0.14, 0.56], [0, dy], 'clamp') },
      { scale: interpolate(t.value, [0.08, 0.13, 0.56, 0.62], [1, 0.86, 0.86, 1], 'clamp') },
    ],
  }));
  // Trail grows from `from` towards `to`, rotated to the swipe direction.
  const trailStyle = useAnimatedStyle(() => {
    const w = interpolate(t.value, [0.14, 0.56], [0, length], 'clamp');
    return {
      opacity: interpolate(t.value, [0.14, 0.22, 0.6, 0.72], [0, 0.75, 0.75, 0], 'clamp'),
      width: w,
      transform: [{ translateX: -w / 2 }, { rotate: angle }, { translateX: w / 2 }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.trail,
          {
            left: a.x,
            top: a.y - trailWidth / 2,
            height: trailWidth,
            borderRadius: trailWidth / 2,
            backgroundColor: theme.ripple.color,
          },
          trailStyle,
        ]}
      />
      <SimHand x={a.x} y={a.y} style={handStyle} />
    </View>
  );
}

// ─── Pinch (two touch points) ────────────────────────────────────────────────

export function PinchSimulation({
  width,
  height,
  at = CENTRE,
  duration = 2600,
}: PresetProps & { at?: RelativePoint }) {
  const theme = useWalkthroughTheme();
  const t = useLoopProgress(duration);
  const c = toPoint(at, width, height);
  const spread = Math.min(width, height) * 0.28;
  const dot = theme.ripple.size * 0.5;

  // The two fingers move apart diagonally from the centre.
  const upperStyle = useAnimatedStyle(() => {
    const d = interpolate(t.value, [0.15, 0.6], [spread * 0.25, spread], 'clamp');
    return {
      opacity: interpolate(t.value, [0.05, 0.15, 0.65, 0.78], [0, 0.9, 0.9, 0], 'clamp'),
      transform: [{ translateX: d }, { translateY: -d * 0.6 }],
    };
  });
  const lowerStyle = useAnimatedStyle(() => {
    const d = interpolate(t.value, [0.15, 0.6], [spread * 0.25, spread], 'clamp');
    return {
      opacity: interpolate(t.value, [0.05, 0.15, 0.65, 0.78], [0, 0.9, 0.9, 0], 'clamp'),
      transform: [{ translateX: -d }, { translateY: d * 0.6 }],
    };
  });

  const dotStyle = {
    left: c.x - dot / 2,
    top: c.y - dot / 2,
    width: dot,
    height: dot,
    borderRadius: dot / 2,
    borderWidth: theme.ripple.width,
    borderColor: theme.ripple.color,
    backgroundColor: theme.hand.fillColor,
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.disc, dotStyle, upperStyle]} />
      <Animated.View style={[styles.disc, dotStyle, lowerStyle]} />
    </View>
  );
}

// ─── Preset dispatcher ───────────────────────────────────────────────────────

export function PresetSimulation({
  preset,
  width,
  height,
}: {
  preset: SimulationPreset;
  width: number;
  height: number;
}) {
  switch (preset.type) {
    case 'tap':
      return <TapSimulation width={width} height={height} at={preset.at} duration={preset.duration} />;
    case 'doubleTap':
      return (
        <TapSimulation width={width} height={height} at={preset.at} duration={preset.duration} double />
      );
    case 'longPress':
      return (
        <LongPressSimulation width={width} height={height} at={preset.at} duration={preset.duration} />
      );
    case 'swipe':
      return (
        <SwipeSimulation
          width={width}
          height={height}
          from={preset.from}
          to={preset.to}
          duration={preset.duration}
        />
      );
    case 'pinch':
      return <PinchSimulation width={width} height={height} at={preset.at} duration={preset.duration} />;
  }
}

export function isSimulationPreset(value: unknown): value is SimulationPreset {
  return (
    typeof value === 'object' &&
    value !== null &&
    !React.isValidElement(value) &&
    typeof (value as { type?: unknown }).type === 'string' &&
    ['tap', 'doubleTap', 'longPress', 'swipe', 'pinch'].includes((value as { type: string }).type)
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
  },
  trail: {
    position: 'absolute',
  },
});
