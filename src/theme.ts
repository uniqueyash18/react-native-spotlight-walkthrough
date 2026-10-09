import type { DeepPartial, WalkthroughLabels, WalkthroughTheme } from './types';

export const defaultTheme: WalkthroughTheme = {
  accentColor: '#4F46E5',
  overlay: {
    color: '#000000',
    opacity: 0.7,
    fadeDuration: 250,
  },
  spotlight: {
    shape: 'rect',
    padding: 8,
    borderRadius: 16,
    transitionDuration: 350,
    ring: {
      show: true,
      width: 2.5,
      pulse: true,
      pulseDuration: 1100,
    },
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    offset: 14,
    arrow: { show: true, size: 10 },
  },
  text: {
    title: { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 24 },
    message: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginTop: 4 },
    stepCounter: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
    hint: { fontSize: 12, fontWeight: '600' },
  },
  hint: {},
  buttons: {
    next: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 99 },
    nextText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    back: { paddingVertical: 9, paddingHorizontal: 12 },
    backText: { fontSize: 14, fontWeight: '600', color: '#374151' },
    skip: { paddingVertical: 9, paddingHorizontal: 4 },
    skipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  },
  progress: {
    showDots: true,
    showCounter: true,
    dotSize: 6,
    activeDotWidth: 18,
    dotColor: '#E5E7EB',
    gap: 5,
  },
  hand: {
    show: true,
    size: 46,
    fillColor: '#FFFFFF',
    strokeColor: '#1F2937',
  },
  ripple: {
    color: '#FFFFFF',
    size: 56,
    width: 3,
  },
  audio: {
    showMuteButton: true,
    iconColor: '#6B7280',
  },
};

export const defaultLabels: WalkthroughLabels = {
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  done: 'Got it!',
  stepCounter: (current, total) => `${current} of ${total}`,
  mute: 'Mute narration',
  unmute: 'Unmute narration',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merges theme overrides. Style objects (ViewStyle / TextStyle) merge key-by-key too. */
export function mergeTheme(
  base: WalkthroughTheme,
  ...overrides: (DeepPartial<WalkthroughTheme> | undefined)[]
): WalkthroughTheme {
  let result: Record<string, unknown> = base as unknown as Record<string, unknown>;
  for (const override of overrides) {
    if (override) result = deepMerge(result, override as Record<string, unknown>);
  }
  return result as unknown as WalkthroughTheme;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const value = override[key];
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out;
}

/** Colours that fall back to `accentColor` when not set explicitly. */
export function resolveAccent(theme: WalkthroughTheme) {
  return {
    ring: theme.spotlight.ring.color ?? theme.accentColor,
    activeDot: theme.progress.activeDotColor ?? theme.accentColor,
    hintBackground: theme.hint.backgroundColor ?? withAlpha(theme.accentColor, 0.12),
  };
}

/** `#RRGGBB` → `rgba(r,g,b,a)`; anything else is returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
