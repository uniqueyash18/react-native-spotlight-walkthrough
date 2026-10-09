import { createContext, useContext } from 'react';
import type { View } from 'react-native';
import { defaultTheme } from './theme';
import type {
  FinishReason,
  NarrationMode,
  StartOptions,
  WalkthroughStep,
  WalkthroughTheme,
  WalkthroughTour,
} from './types';

export interface WalkthroughContextValue {
  /** Starts a tour. Resolves `false` when it was skipped because `showOnce` and already seen. */
  start: (tour: WalkthroughTour, options?: StartOptions) => Promise<boolean>;
  next: () => void;
  back: () => void;
  goTo: (step: string | number) => void;
  /** Ends the tour as "skipped" (marks it seen when `showOnce`). */
  skip: () => void;
  /** Ends the tour without marking it seen. */
  stop: () => void;
  /** Patch a step of the running tour — e.g. put the name of what the user just tapped into its message. */
  updateStep: (id: string, patch: Partial<WalkthroughStep>) => void;
  /** Re-measure the current target (after a layout change you know about). */
  refresh: () => void;

  isActive: boolean;
  tourId: string | null;
  currentStep: WalkthroughStep | null;
  stepIndex: number;
  totalSteps: number;

  /** The user's mute toggle (the tooltip's speaker button). */
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Current narration mode — starts from the provider's `narration` prop. */
  narration: NarrationMode;
  setNarration: (mode: NarrationMode) => void;

  hasSeen: (tourId: string) => Promise<boolean>;
  markSeen: (tourId: string) => Promise<void>;
  resetSeen: (tourId: string) => Promise<void>;

  /** @internal used by WalkthroughTarget */
  registerTarget: (
    id: string,
    ref: React.RefObject<View | null>,
    scrollChain?: readonly React.RefObject<unknown>[],
  ) => () => void;
  /** @internal last finish reason, for tests / debugging */
  lastFinishReason: FinishReason | null;
}

export const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

/** The resolved theme for the step being shown (provider theme + step override). */
export const ActiveThemeContext = createContext<WalkthroughTheme>(defaultTheme);

export function useWalkthrough(): WalkthroughContextValue {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) {
    throw new Error('useWalkthrough must be used inside <WalkthroughProvider>.');
  }
  return ctx;
}

export function useWalkthroughTheme(): WalkthroughTheme {
  return useContext(ActiveThemeContext);
}
