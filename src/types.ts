import type React from 'react';
import type { ReactNode } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';

// ─── Geometry ────────────────────────────────────────────────────────────────

/** A rectangle in window coordinates (what `measureInWindow` returns). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A point expressed as a fraction (0–1) of the target's width / height. */
export interface RelativePoint {
  x: number;
  y: number;
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * - `rect`   — rounded rectangle, corner radius from `borderRadius`
 * - `pill`   — rectangle with fully rounded ends
 * - `circle` — smallest circle that covers the target
 * - `none`   — no hole; the whole screen is dimmed (intro / outro cards)
 */
export type SpotlightShape = 'rect' | 'pill' | 'circle' | 'none';

export type TooltipPlacement = 'auto' | 'top' | 'bottom' | 'center';

// ─── Simulations ─────────────────────────────────────────────────────────────

interface SimulationBase {
  /** One loop of the animation, in ms. */
  duration?: number;
}

export type SimulationPreset =
  | (SimulationBase & { type: 'tap'; at?: RelativePoint })
  | (SimulationBase & { type: 'doubleTap'; at?: RelativePoint })
  | (SimulationBase & { type: 'longPress'; at?: RelativePoint })
  | (SimulationBase & { type: 'swipe'; from?: RelativePoint; to?: RelativePoint })
  | (SimulationBase & { type: 'pinch'; at?: RelativePoint });

export interface SimulationRenderContext {
  /** Size of the spotlight hole the simulation is drawn in. */
  width: number;
  height: number;
  theme: WalkthroughTheme;
}

/**
 * What to animate over the spotlight hole:
 * - a preset (`{ type: 'tap' }`)
 * - any element (built from the exported `SimHand` / `TapRipple` / `useLoopProgress`)
 * - a render function that receives the hole's size
 */
export type StepSimulation =
  | SimulationPreset
  | ReactNode
  | ((context: SimulationRenderContext) => ReactNode);

// ─── Steps & tours ───────────────────────────────────────────────────────────

/** Opaque — whatever your audio adapter's `play` accepts (a `require()`d asset, a URI…). */
export type AudioSource = unknown;

/**
 * How steps are narrated:
 * - `auto`  — play the step's `audio`; speak its text (TTS) when it has none or it fails
 * - `audio` — audio files only, never TTS
 * - `tts`   — always TTS, ignore audio files
 * - `off`   — silent
 */
export type NarrationMode = 'auto' | 'audio' | 'tts' | 'off';

export type BackdropPressAction = 'none' | 'next' | 'skip' | 'stop';

export interface WalkthroughStep {
  id: string;
  /**
   * What to spotlight:
   * - the `id` of a `<WalkthroughTarget>` / `useWalkthroughTarget`
   * - a fixed window-space `Rect`
   * - a function resolving to a `Rect` (or `null` to retry until `measureTimeout`)
   * Omit for a centred card with no hole.
   */
  target?: string | Rect | (() => Rect | null | Promise<Rect | null>);
  title?: string;
  message?: string;
  /** Extra content inside the tooltip, between the message and the buttons. */
  content?: ReactNode;
  /** Replace the whole tooltip for this step. Takes precedence over the provider's `renderTooltip`. */
  renderTooltip?: (props: TooltipRenderProps) => ReactNode;

  shape?: SpotlightShape;
  /** Space between the target's bounds and the hole's edge. */
  padding?: number;
  /** Corner radius for `shape: 'rect'`. */
  borderRadius?: number;
  placement?: TooltipPlacement;

  /** Let touches inside the hole reach the real UI underneath. Default `false`. */
  interactive?: boolean;
  /** Animated gesture played over the hole while the step is shown. */
  simulation?: StepSimulation;
  /** Shown as a small pill in the tooltip — e.g. "Try it — tap the car". */
  hint?: string;

  /** Played (through the provider's `audio` adapter) when the step appears. */
  audio?: AudioSource;
  /**
   * Text for TTS (through the provider's `speech` adapter). Defaults to the
   * title + message; `false` never speaks this step.
   */
  speak?: string | false;
  /** Overrides the provider's `narration` mode for this step. */
  narration?: NarrationMode;

  showSkip?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  /** Override the Next / Done label for this step. */
  nextLabel?: string;
  backdropPress?: BackdropPressAction;

  /** Per-step theme override, deep-merged over the provider theme. */
  theme?: DeepPartial<WalkthroughTheme>;

  /**
   * Scroll the target into view (with room for the tooltip) before
   * spotlighting it. Default: the provider's `autoScroll` (on).
   */
  autoScroll?: boolean;
  /**
   * The scrollable to use for this step's target — overrides the one picked
   * up from `WalkthroughScrollView` / `WalkthroughScrollContainer` / the
   * target's `scrollRef`. Any ScrollView / FlatList / SectionList ref.
   */
  scrollRef?: React.RefObject<unknown>;
  /** Awaited before the target is measured — open a drawer, `scrollToIndex` a list item into range, etc. */
  onBeforeEnter?: () => void | Promise<void>;
  onEnter?: () => void;
  onExit?: () => void;
}

export interface WalkthroughTour {
  id: string;
  steps: WalkthroughStep[];
  /** Only show this tour once per `storage` (requires the provider's `storage`). */
  showOnce?: boolean;
}

export interface StartOptions {
  /** Ignore `showOnce` and start anyway (e.g. a "replay tour" button). */
  force?: boolean;
  /** Step id or index to start at. */
  startAt?: string | number;
  /** Delay before the first step appears, in ms. */
  delay?: number;
}

export type FinishReason = 'completed' | 'skipped' | 'stopped';

// ─── Theme ───────────────────────────────────────────────────────────────────

export interface WalkthroughTheme {
  /** Convenience colour used by the ring, dots, Next button and ripple unless they're set explicitly. */
  accentColor: string;
  overlay: {
    color: string;
    opacity: number;
    /** Fade in/out duration, ms. */
    fadeDuration: number;
  };
  spotlight: {
    shape: SpotlightShape;
    padding: number;
    borderRadius: number;
    /** Duration of the hole morphing from one step's target to the next, ms. 0 = jump. */
    transitionDuration: number;
    ring: {
      show: boolean;
      color?: string;
      width: number;
      pulse: boolean;
      pulseDuration: number;
    };
  };
  tooltip: {
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    /** Distance from the screen edges. */
    marginHorizontal: number;
    /** Distance from the spotlight hole. */
    offset: number;
    maxWidth?: number;
    arrow: { show: boolean; size: number };
    style?: ViewStyle;
  };
  text: {
    title: TextStyle;
    message: TextStyle;
    stepCounter: TextStyle;
    hint: TextStyle;
  };
  hint: {
    backgroundColor?: string;
    style?: ViewStyle;
  };
  buttons: {
    next: ViewStyle;
    nextText: TextStyle;
    back: ViewStyle;
    backText: TextStyle;
    skip: ViewStyle;
    skipText: TextStyle;
  };
  progress: {
    showDots: boolean;
    showCounter: boolean;
    dotSize: number;
    activeDotWidth: number;
    dotColor: string;
    activeDotColor?: string;
    gap: number;
  };
  hand: {
    show: boolean;
    size: number;
    fillColor: string;
    strokeColor: string;
  };
  ripple: {
    color: string;
    size: number;
    width: number;
  };
  audio: {
    showMuteButton: boolean;
    iconColor: string;
  };
}

/**
 * Every field optional, recursively — except style objects (ViewStyle /
 * TextStyle), which are passed through as-is. Style objects are detected as
 * types that a plain `ViewStyle` is assignable to; a theme group like
 * `tooltip` has required fields, so it isn't mistaken for one.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: NonNullable<T[K]> extends (...args: never[]) => unknown
    ? T[K]
    : NonNullable<T[K]> extends object
      ? ViewStyle extends NonNullable<T[K]>
        ? T[K]
        : DeepPartial<NonNullable<T[K]>>
      : T[K];
};

export interface WalkthroughLabels {
  next: string;
  back: string;
  skip: string;
  done: string;
  stepCounter: (current: number, total: number) => string;
  /** Accessibility labels for the mute toggle. */
  mute: string;
  unmute: string;
}

// ─── Adapters ────────────────────────────────────────────────────────────────

export interface WalkthroughAudioAdapter {
  /**
   * Start playing `source`. Resolve once playback has started; reject (or
   * throw) if it can't load or play — in `auto` narration that's what
   * triggers the TTS fallback.
   */
  play(source: AudioSource): void | Promise<void>;
  stop(): void | Promise<void>;
}

export interface SpeechOptions {
  /** BCP 47 language code, e.g. `en-US`, `ar-SA`, `ur-PK`. */
  language?: string;
}

/** Text-to-speech, used for `tts` narration and as the `auto` fallback. */
export interface WalkthroughSpeechAdapter {
  speak(text: string, options?: SpeechOptions): void | Promise<void>;
  stop(): void | Promise<void>;
}

/** AsyncStorage / MMKV / expo-secure-store shaped — anything with get + set. */
export interface WalkthroughStorage {
  getItem(key: string): string | null | undefined | Promise<string | null | undefined>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem?(key: string): void | Promise<void>;
}

// ─── Render props ────────────────────────────────────────────────────────────

export interface TooltipRenderProps {
  step: WalkthroughStep;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  theme: WalkthroughTheme;
  labels: WalkthroughLabels;
  muted: boolean;
  hasAudio: boolean;
  next: () => void;
  back: () => void;
  skip: () => void;
  stop: () => void;
  toggleMute: () => void;
}

export interface HandRenderProps {
  size: number;
  fillColor: string;
  strokeColor: string;
}
