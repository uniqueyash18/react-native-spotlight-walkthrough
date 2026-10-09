import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ActiveThemeContext } from '../context';
import { isSimulationPreset, PresetSimulation } from '../simulation/presets';
import { resolveAccent } from '../theme';
import type {
  BackdropPressAction,
  Insets,
  Rect,
  TooltipRenderProps,
  WalkthroughStep,
  WalkthroughTheme,
} from '../types';
import { DefaultTooltip } from './DefaultTooltip';
import {
  computeArrowOffset,
  computeBlockers,
  computeHole,
  computeTooltipPosition,
  overlayPath,
  roundedRectPath,
  type Hole,
} from './geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpotlightOverlayProps {
  step: WalkthroughStep;
  /** Window-space rect, or `null` while measuring / for a centred step. */
  target: Rect | null;
  /** True once the current step's target has been resolved (or it has none). */
  ready: boolean;
  /** The content under the overlay is being scrolled — shrink the hole away until it settles. */
  collapsed?: boolean;
  theme: WalkthroughTheme;
  insets: Insets;
  tooltipProps: Omit<TooltipRenderProps, 'theme' | 'step'>;
  renderTooltip?: (props: TooltipRenderProps) => React.ReactNode;
  onBackdropAction: (action: BackdropPressAction) => void;
}

/**
 * Full-screen dim layer with an animated hole, a pulsing ring, touch blockers
 * around the hole (the hole itself passes touches through when the step is
 * `interactive`), the step's gesture simulation, and the positioned tooltip.
 */
export function SpotlightOverlay({
  step,
  target,
  ready,
  collapsed = false,
  theme,
  insets,
  tooltipProps,
  renderTooltip,
  onBackdropAction,
}: SpotlightOverlayProps) {
  const rootRef = useRef<View>(null);
  const [frame, setFrame] = useState<Frame | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    rootRef.current?.measureInWindow((x, y) => setFrame({ x, y, width, height }));
  };

  const shape = step.shape ?? theme.spotlight.shape;
  const hole: Hole | null = frame
    ? computeHole(
        target,
        frame,
        frame,
        shape,
        step.padding ?? theme.spotlight.padding,
        step.borderRadius ?? theme.spotlight.borderRadius,
      )
    : null;

  // ── Animated hole ──────────────────────────────────────────────────────────
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const hr = useSharedValue(0);
  const hasHole = useRef(false);

  // Collapse the hole to a point while the content scrolls under it; the next
  // placement then grows out of that point at the target's new position.
  useEffect(() => {
    if (!collapsed || !hasHole.current) return;
    const duration = Math.min(theme.spotlight.transitionDuration, 200);
    const timing = (v: number) => withTiming(v, { duration, easing: Easing.out(Easing.cubic) });
    hx.value = timing(hx.value + hw.value / 2);
    hy.value = timing(hy.value + hh.value / 2);
    hw.value = timing(0);
    hh.value = timing(0);
    hr.value = timing(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  useEffect(() => {
    if (!hole || !ready || collapsed) return;
    const values: [typeof hx, number][] = [
      [hx, hole.x],
      [hy, hole.y],
      [hw, hole.width],
      [hh, hole.height],
      [hr, hole.radius],
    ];
    const duration = theme.spotlight.transitionDuration;
    // First placement (or a hole appearing from a centred step) jumps; later ones morph.
    const animate = hasHole.current && duration > 0 && hole.width > 0;
    for (const [sv, value] of values) {
      sv.value = animate
        ? withTiming(value, { duration, easing: Easing.out(Easing.cubic) })
        : value;
    }
    // Stays true through a collapse, so the reopening morphs instead of jumping.
    hasHole.current = hasHole.current || hole.width > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole?.x, hole?.y, hole?.width, hole?.height, hole?.radius, ready, collapsed]);

  const pulse = useSharedValue(1);
  const { ring } = theme.spotlight;
  useEffect(() => {
    if (!ring.pulse) {
      pulse.value = 1;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: ring.pulseDuration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [ring.pulse, ring.pulseDuration, pulse]);

  const W = frame?.width ?? 0;
  const H = frame?.height ?? 0;

  const dimProps = useAnimatedProps(() => ({
    d: overlayPath(W, H, hx.value, hy.value, hw.value, hh.value, hr.value),
  }));
  const ringProps = useAnimatedProps(() => ({
    d: roundedRectPath(hx.value, hy.value, hw.value, hh.value, hr.value),
    strokeOpacity: 0.55 + pulse.value * 0.45,
  }));

  const accent = resolveAccent(theme);
  const backdropPress = step.backdropPress ?? 'none';
  const interactive = !!step.interactive && !!hole && hole.width > 0;
  const blockers = hole
    ? interactive
      ? computeBlockers(hole, frame!)
      : [{ x: 0, y: 0, width: W, height: H }]
    : [];

  const tooltipPosition =
    hole && ready
      ? computeTooltipPosition(
          hole,
          frame!,
          insets,
          step.placement ?? 'auto',
          theme.tooltip.offset,
        )
      : null;
  const tooltipWidth = Math.min(
    W - theme.tooltip.marginHorizontal * 2,
    theme.tooltip.maxWidth ?? Number.POSITIVE_INFINITY,
  );
  const tooltipLeft = (W - tooltipWidth) / 2;

  const tooltipRenderProps: TooltipRenderProps = { ...tooltipProps, step, theme };
  const tooltip = (step.renderTooltip ?? renderTooltip)?.(tooltipRenderProps) ?? (
    <DefaultTooltip {...tooltipRenderProps} />
  );

  const showArrow =
    theme.tooltip.arrow.show && tooltipPosition && tooltipPosition.mode !== 'center' && hole;
  const arrowSize = theme.tooltip.arrow.size;

  return (
    <ActiveThemeContext.Provider value={theme}>
      <Animated.View
        ref={rootRef}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
        onLayout={onLayout}
        entering={FadeIn.duration(theme.overlay.fadeDuration)}
        exiting={FadeOut.duration(theme.overlay.fadeDuration)}
        accessibilityViewIsModal
      >
        {frame && (
          <>
            {/* Geometry layer — window coordinates, so it's pinned to LTR even in RTL apps. */}
            <View style={[StyleSheet.absoluteFill, styles.ltr]} pointerEvents="box-none">
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width={W} height={H}>
                  <AnimatedPath
                    animatedProps={dimProps}
                    fill={theme.overlay.color}
                    fillOpacity={theme.overlay.opacity}
                    fillRule="evenodd"
                  />
                  {ring.show && ready && hole && hole.width > 0 && (
                    <AnimatedPath
                      animatedProps={ringProps}
                      fill="none"
                      stroke={accent.ring}
                      strokeWidth={ring.width}
                    />
                  )}
                </Svg>
              </View>

              {blockers.map((b, i) => (
                <View
                  key={i}
                  style={[styles.abs, { left: b.x, top: b.y, width: b.width, height: b.height }]}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => onBackdropAction(backdropPress)}
                />
              ))}

              {ready && hole && hole.width > 0 && step.simulation != null && (
                <View
                  key={step.id}
                  pointerEvents="none"
                  style={[
                    styles.abs,
                    styles.clip,
                    {
                      left: hole.x,
                      top: hole.y,
                      width: hole.width,
                      height: hole.height,
                      borderRadius: hole.radius,
                    },
                  ]}
                >
                  {renderSimulation(step, hole, theme)}
                </View>
              )}
            </View>

            {tooltipPosition && (
              <View
                style={
                  tooltipPosition.mode === 'center'
                    ? [StyleSheet.absoluteFill, styles.centre]
                    : StyleSheet.absoluteFill
                }
                pointerEvents="box-none"
              >
                <Animated.View
                  key={step.id}
                  entering={FadeIn.duration(220)}
                  style={[
                    tooltipPosition.mode === 'center'
                      ? { width: tooltipWidth }
                      : [
                          styles.abs,
                          { left: tooltipLeft, width: tooltipWidth },
                          tooltipPosition.mode === 'below'
                            ? { top: tooltipPosition.top }
                            : { bottom: tooltipPosition.bottom },
                        ],
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  {showArrow && (
                    <View style={[StyleSheet.absoluteFill, styles.ltr]} pointerEvents="none">
                      <View
                        style={[
                          styles.arrow,
                          {
                            width: arrowSize * 2,
                            height: arrowSize * 2,
                            left: computeArrowOffset(
                              hole!,
                              tooltipLeft,
                              tooltipWidth,
                              arrowSize,
                              theme.tooltip.borderRadius,
                            ),
                            backgroundColor: theme.tooltip.backgroundColor,
                          },
                          tooltipPosition.mode === 'below'
                            ? { top: -arrowSize * 0.7 }
                            : { bottom: -arrowSize * 0.7 },
                        ]}
                      />
                    </View>
                  )}
                  {tooltip}
                </Animated.View>
              </View>
            )}
          </>
        )}
      </Animated.View>
    </ActiveThemeContext.Provider>
  );
}

function renderSimulation(step: WalkthroughStep, hole: Hole, theme: WalkthroughTheme) {
  const sim = step.simulation;
  if (typeof sim === 'function') {
    return sim({ width: hole.width, height: hole.height, theme });
  }
  if (isSimulationPreset(sim)) {
    return <PresetSimulation preset={sim} width={hole.width} height={hole.height} />;
  }
  return sim as React.ReactNode;
}

const styles = StyleSheet.create({
  ltr: {
    direction: 'ltr',
  },
  abs: {
    position: 'absolute',
  },
  clip: {
    overflow: 'hidden',
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
});
