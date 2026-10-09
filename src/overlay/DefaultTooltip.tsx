import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { resolveAccent } from '../theme';
import type { TooltipRenderProps } from '../types';

/**
 * The built-in tooltip card: progress dots + counter, optional mute toggle,
 * title, message, the step's `content`, an optional hint pill, then
 * Skip / Back / Next. Every part is styled from the theme; to restructure it
 * entirely pass `renderTooltip` to the provider (or a step) instead.
 */
export function DefaultTooltip({
  step,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  theme,
  labels,
  muted,
  hasAudio,
  next,
  back,
  skip,
  toggleMute,
}: TooltipRenderProps) {
  const accent = resolveAccent(theme);
  const { progress } = theme;
  const showSkip = step.showSkip ?? !isLast;
  const showBack = step.showBack ?? false;
  const showNext = step.showNext ?? true;
  const showHeader =
    (progress.showDots || progress.showCounter || (hasAudio && theme.audio.showMuteButton)) &&
    totalSteps > 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.tooltip.backgroundColor,
          borderRadius: theme.tooltip.borderRadius,
          padding: theme.tooltip.padding,
        },
        theme.tooltip.style,
      ]}
    >
      {showHeader && (
        <View style={styles.header}>
          {progress.showDots ? (
            <View style={[styles.dots, { gap: progress.gap }]}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === stepIndex ? progress.activeDotWidth : progress.dotSize,
                    height: progress.dotSize,
                    borderRadius: progress.dotSize / 2,
                    backgroundColor: i <= stepIndex ? accent.activeDot : progress.dotColor,
                    opacity: i < stepIndex ? 0.4 : 1,
                  }}
                />
              ))}
            </View>
          ) : (
            <View />
          )}
          <View style={styles.headerEnd}>
            {progress.showCounter && (
              <Text style={theme.text.stepCounter}>
                {labels.stepCounter(stepIndex + 1, totalSteps)}
              </Text>
            )}
            {hasAudio && theme.audio.showMuteButton && (
              <TouchableOpacity
                onPress={toggleMute}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={muted ? labels.unmute : labels.mute}
              >
                <SpeakerIcon muted={muted} color={theme.audio.iconColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {!!step.title && (
        <Text style={theme.text.title} accessibilityRole="header">
          {step.title}
        </Text>
      )}
      {!!step.message && <Text style={theme.text.message}>{step.message}</Text>}

      {step.content}

      {!!step.hint && (
        <View
          style={[styles.hint, { backgroundColor: accent.hintBackground }, theme.hint.style]}
        >
          <View style={[styles.hintDot, { backgroundColor: theme.accentColor }]} />
          <Text style={[{ color: theme.accentColor }, theme.text.hint]}>{step.hint}</Text>
        </View>
      )}

      {(showSkip || showBack || showNext) && (
        <View style={styles.footer}>
          {showSkip && (
            <TouchableOpacity onPress={skip} activeOpacity={0.7} style={theme.buttons.skip} accessibilityRole="button">
              <Text style={theme.buttons.skipText}>{labels.skip}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.spacer} />
          {showBack && !isFirst && (
            <TouchableOpacity onPress={back} activeOpacity={0.7} style={theme.buttons.back} accessibilityRole="button">
              <Text style={theme.buttons.backText}>{labels.back}</Text>
            </TouchableOpacity>
          )}
          {showNext && (
            <TouchableOpacity
              onPress={next}
              activeOpacity={0.85}
              style={[{ backgroundColor: theme.accentColor }, theme.buttons.next]}
              accessibilityRole="button"
            >
              <Text style={theme.buttons.nextText}>
                {step.nextLabel ?? (isLast ? labels.done : labels.next)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function SpeakerIcon({ muted, color }: { muted: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9v6h4l5 4V5L7 9H3z" fill={color} />
      {muted ? (
        <Path d="M16 9l6 6M22 9l-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      ) : (
        <Path
          d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
});
