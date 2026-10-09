import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Rect } from 'react-native-svg';
import { useWalkthroughTheme } from '../context';
import type { HandRenderProps } from '../types';

/*
 * Building blocks for gesture simulations.
 *
 * Every element of one simulation reads the same looping 0→1 clock from
 * `useLoopProgress` and maps it to its own keyframes with `interpolate`, so
 * the hand, the ripple and whatever UI the gesture "causes" stay in sync
 * without chaining callbacks between separate animations:
 *
 *   const t = useLoopProgress(2400);
 *   const handStyle = useAnimatedStyle(() => ({
 *     opacity: interpolate(t.value, [0, 0.15, 0.8, 0.9], [0, 1, 1, 0], 'clamp'),
 *     transform: [{ scale: tapPressScale(t.value, 0.3) }],
 *   }));
 *   <SimHand x={cx} y={cy} style={handStyle} />
 *   <TapRipple progress={t} x={cx} y={cy} at={0.3} />
 */

/** Linear 0→1 clock that restarts every `duration` ms while mounted. */
export function useLoopProgress(duration: number): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [duration, progress]);
  return progress;
}

/** Hand "press" keyframes — 1 → 0.82 → 1 around `at`. Call from inside a worklet. */
export function tapPressScale(t: number, at: number): number {
  'worklet';
  return interpolate(t, [at - 0.04, at, at + 0.05], [1, 0.82, 1], 'clamp');
}

// ─── Hand ────────────────────────────────────────────────────────────────────

// Drawn on a 24×32 grid; the index fingertip is at (11, 1).
const HAND_VIEWBOX = { width: 24, height: 32 };
const HAND_FINGERTIP = { x: 11, y: 1 };

function HandShapes({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Rect x={8} y={1} width={6} height={20} rx={3} />
      <Rect x={13.4} y={10} width={5.2} height={11} rx={2.6} />
      <Rect x={17.8} y={11.8} width={4.8} height={10} rx={2.4} />
      <Rect x={5} y={14} width={17.6} height={16.5} rx={6} />
      <Rect x={1.8} y={15.5} width={5.4} height={10.5} rx={2.7} transform="rotate(-24 4.5 20.75)" />
    </G>
  );
}

/** Default pointing hand. Replace it with the provider's `renderHand`. */
export function DefaultHand({ size, fillColor, strokeColor }: HandRenderProps) {
  const height = size;
  const width = (size * HAND_VIEWBOX.width) / HAND_VIEWBOX.height;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`-1.5 -1.5 ${HAND_VIEWBOX.width + 3} ${HAND_VIEWBOX.height + 3}`}
    >
      {/* Outline pass: every shape stroked, then filled on top, so only the union's edge shows. */}
      <G stroke={strokeColor} strokeWidth={2.6} strokeLinejoin="round">
        <HandShapes fill={strokeColor} />
      </G>
      <HandShapes fill={fillColor} />
    </Svg>
  );
}

/** Lets the provider swap the hand without every simulation knowing about it. */
export const HandRendererContext = React.createContext<(props: HandRenderProps) => React.ReactNode>(
  (props) => <DefaultHand {...props} />,
);

export interface SimHandProps {
  /** Fingertip position inside the parent. */
  x: number;
  y: number;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  size?: number;
}

/** Pointing hand whose fingertip sits on (x, y). Drive it with an animated `style`. */
export function SimHand({ x, y, style, size }: SimHandProps) {
  const theme = useWalkthroughTheme();
  const renderHand = React.useContext(HandRendererContext);
  if (!theme.hand.show) return null;
  const handSize = size ?? theme.hand.size;
  const scale = handSize / HAND_VIEWBOX.height;
  const tipX = (HAND_FINGERTIP.x + 1.5) * scale;
  const tipY = (HAND_FINGERTIP.y + 1.5) * scale;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.hand, { left: x - tipX, top: y - tipY }, style]}
    >
      {renderHand({
        size: handSize,
        fillColor: theme.hand.fillColor,
        strokeColor: theme.hand.strokeColor,
      })}
    </Animated.View>
  );
}

// ─── Ripple ──────────────────────────────────────────────────────────────────

export interface TapRippleProps {
  progress: SharedValue<number>;
  x: number;
  y: number;
  /** Point on the 0→1 clock where the tap lands. */
  at: number;
  /** Fraction of the clock the ripple takes to fade. */
  span?: number;
  size?: number;
  color?: string;
}

/** Expanding ring marking the moment a simulated tap lands. */
export function TapRipple({ progress, x, y, at, span = 0.22, size, color }: TapRippleProps) {
  const theme = useWalkthroughTheme();
  const rippleSize = size ?? theme.ripple.size;
  const style = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [at, at + span], [0, 1], 'clamp');
    const active = progress.value >= at && progress.value <= at + span;
    return {
      opacity: active ? 0.9 * (1 - p) : 0,
      transform: [{ scale: 0.3 + p * 1.2 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          left: x - rippleSize / 2,
          top: y - rippleSize / 2,
          width: rippleSize,
          height: rippleSize,
          borderRadius: rippleSize / 2,
          borderWidth: theme.ripple.width,
          borderColor: color ?? theme.ripple.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  hand: {
    position: 'absolute',
    zIndex: 10,
  },
  ripple: {
    position: 'absolute',
  },
});
