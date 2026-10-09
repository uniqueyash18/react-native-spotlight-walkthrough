import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, Dimensions, Modal, type View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { WalkthroughContext, type WalkthroughContextValue } from './context';
import { SpotlightOverlay } from './overlay/SpotlightOverlay';
import { HandRendererContext, DefaultHand } from './simulation/primitives';
import { defaultLabels, defaultTheme, mergeTheme } from './theme';
import {
  initialTourState,
  resolveStepIndex,
  storageKeyFor,
  tourReducer,
} from './tourState';
import type {
  BackdropPressAction,
  DeepPartial,
  FinishReason,
  HandRenderProps,
  Insets,
  Rect,
  StartOptions,
  TooltipRenderProps,
  WalkthroughAudioAdapter,
  WalkthroughLabels,
  WalkthroughStep,
  WalkthroughStorage,
  WalkthroughTheme,
  WalkthroughTour,
} from './types';

export interface WalkthroughProviderProps {
  children: ReactNode;
  /** Deep-merged over the default theme. Steps can override further with `step.theme`. */
  theme?: DeepPartial<WalkthroughTheme>;
  /** Button / counter text — pass translated strings for i18n. */
  labels?: Partial<WalkthroughLabels>;

  /** Plays each step's `audio`. See `react-native-spotlight-walkthrough/expo-audio`. */
  audio?: WalkthroughAudioAdapter;
  /** Start muted. The user can toggle it from the tooltip (theme.audio.showMuteButton). */
  initiallyMuted?: boolean;

  /** Where `showOnce` tours remember they've been seen. */
  storage?: WalkthroughStorage;
  storageKeyPrefix?: string;

  /** Replace the tooltip for every step. */
  renderTooltip?: (props: TooltipRenderProps) => ReactNode;
  /** Replace the simulation hand (e.g. with an icon font glyph or an image). */
  renderHand?: (props: HandRenderProps) => ReactNode;

  /**
   * `root` (default) draws the overlay in the app's own view tree, which is
   * what lets interactive steps pass touches through to the real UI. `modal`
   * draws it in a native Modal — use it if your screens are presented in
   * native modals the root overlay can't cover; interactive holes don't pass
   * touches through in this mode.
   */
  overlayHost?: 'root' | 'modal';
  /** Overrides the safe-area insets (read from react-native-safe-area-context otherwise). */
  insets?: Insets;
  /** Android hardware back while a tour is showing. Default `skip`. */
  androidBack?: 'skip' | 'back' | 'stop' | 'none';
  /** How long to keep retrying a target that isn't mounted / measurable yet, ms. Default 2000. */
  measureTimeout?: number;

  onStart?: (tourId: string) => void;
  onStepChange?: (step: WalkthroughStep, index: number, tourId: string) => void;
  onFinish?: (tourId: string, reason: FinishReason) => void;
}

const ZERO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };
const MEASURE_RETRY_MS = 100;

export function WalkthroughProvider({
  children,
  theme: themeOverride,
  labels: labelsOverride,
  audio,
  initiallyMuted = false,
  storage,
  storageKeyPrefix = 'walkthrough_seen_',
  renderTooltip,
  renderHand,
  overlayHost = 'root',
  insets: insetsOverride,
  androidBack = 'skip',
  measureTimeout = 2000,
  onStart,
  onStepChange,
  onFinish,
}: WalkthroughProviderProps) {
  const [state, dispatch] = useReducer(tourReducer, initialTourState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [muted, setMuted] = useState(initiallyMuted);
  const [target, setTarget] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [measureTick, setMeasureTick] = useState(0);
  const [lastFinishReason, setLastFinishReason] = useState<FinishReason | null>(null);

  const targets = useRef(new Map<string, React.RefObject<View | null>>());
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const insets = insetsOverride ?? safeAreaInsets ?? ZERO_INSETS;

  // Latest callbacks / adapters without re-running effects when they change identity.
  const latest = useRef({ onStart, onStepChange, onFinish, audio, storage, muted });
  latest.current = { onStart, onStepChange, onFinish, audio, storage, muted };

  const baseTheme = useMemo(() => mergeTheme(defaultTheme, themeOverride), [themeOverride]);
  const labels = useMemo(() => ({ ...defaultLabels, ...labelsOverride }), [labelsOverride]);

  const { tour, index } = state;
  const step = tour ? tour.steps[index] : null;
  const stepTheme = useMemo(
    () => (step?.theme ? mergeTheme(baseTheme, step.theme) : baseTheme),
    [baseTheme, step?.theme],
  );

  // ── Storage ────────────────────────────────────────────────────────────────

  const hasSeen = useCallback(
    async (tourId: string) => {
      const s = latest.current.storage;
      if (!s) return false;
      try {
        return (await s.getItem(storageKeyFor(storageKeyPrefix, tourId))) === 'true';
      } catch {
        return false;
      }
    },
    [storageKeyPrefix],
  );

  const markSeen = useCallback(
    async (tourId: string) => {
      try {
        await latest.current.storage?.setItem(storageKeyFor(storageKeyPrefix, tourId), 'true');
      } catch {
        // Persistence is best-effort; the tour itself already finished.
      }
    },
    [storageKeyPrefix],
  );

  const resetSeen = useCallback(
    async (tourId: string) => {
      const s = latest.current.storage;
      const key = storageKeyFor(storageKeyPrefix, tourId);
      try {
        if (s?.removeItem) await s.removeItem(key);
        else await s?.setItem(key, 'false');
      } catch {
        // best-effort
      }
    },
    [storageKeyPrefix],
  );

  // ── Audio ──────────────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    try {
      void latest.current.audio?.stop();
    } catch {
      // ignore adapter failures
    }
  }, []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  const finish = useCallback(
    (reason: FinishReason) => {
      const current = stateRef.current;
      if (!current.tour) return;
      const { tour: finished, index: at } = current;
      finished.steps[at]?.onExit?.();
      stopAudio();
      dispatch({ type: 'end' });
      setTarget(null);
      setReady(false);
      setLastFinishReason(reason);
      if (finished.showOnce && reason !== 'stopped') void markSeen(finished.id);
      latest.current.onFinish?.(finished.id, reason);
    },
    [markSeen, stopAudio],
  );

  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(
    async (newTour: WalkthroughTour, options: StartOptions = {}) => {
      if (newTour.steps.length === 0) return false;
      if (newTour.showOnce && !options.force && (await hasSeen(newTour.id))) return false;

      if (stateRef.current.tour) finish('stopped');
      const startIndex =
        options.startAt === undefined ? 0 : Math.max(resolveStepIndex(newTour, options.startAt), 0);

      const begin = () => {
        setReady(false);
        setTarget(null);
        setLastFinishReason(null);
        dispatch({ type: 'start', tour: newTour, index: startIndex });
        latest.current.onStart?.(newTour.id);
      };
      if (startTimer.current) clearTimeout(startTimer.current);
      if (options.delay) startTimer.current = setTimeout(begin, options.delay);
      else begin();
      return true;
    },
    [finish, hasSeen],
  );

  useEffect(() => () => {
    if (startTimer.current) clearTimeout(startTimer.current);
  }, []);

  const next = useCallback(() => {
    const current = stateRef.current;
    if (!current.tour) return;
    if (current.index >= current.tour.steps.length - 1) {
      finish('completed');
      return;
    }
    current.tour.steps[current.index]?.onExit?.();
    dispatch({ type: 'next' });
  }, [finish]);

  const back = useCallback(() => {
    const current = stateRef.current;
    if (!current.tour || current.index === 0) return;
    current.tour.steps[current.index]?.onExit?.();
    dispatch({ type: 'back' });
  }, []);

  const goTo = useCallback((to: string | number) => {
    const current = stateRef.current;
    if (!current.tour) return;
    const toIndex = resolveStepIndex(current.tour, to);
    if (toIndex === -1 || toIndex === current.index) return;
    current.tour.steps[current.index]?.onExit?.();
    dispatch({ type: 'goTo', step: toIndex });
  }, []);

  const skip = useCallback(() => finish('skipped'), [finish]);
  const stop = useCallback(() => finish('stopped'), [finish]);
  const updateStep = useCallback(
    (id: string, patch: Partial<WalkthroughStep>) => dispatch({ type: 'updateStep', id, patch }),
    [],
  );
  const refresh = useCallback(() => setMeasureTick((n) => n + 1), []);

  const registerTarget = useCallback((id: string, ref: React.RefObject<View | null>) => {
    targets.current.set(id, ref);
    return () => {
      if (targets.current.get(id) === ref) targets.current.delete(id);
    };
  }, []);

  // ── Per-step: onBeforeEnter → measure → onEnter + audio ────────────────────

  const stepKey = tour ? `${tour.id}:${index}:${step?.id}` : null;
  const measuredStepKey = useRef<string | null>(null);

  useEffect(() => {
    if (!tour || !step) {
      measuredStepKey.current = null;
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Same step re-measured (refresh / rotation): keep the hole on screen and
    // don't re-run onEnter or replay audio. A new step resets everything.
    const isRefresh = measuredStepKey.current === stepKey;

    const measureOnce = (): Promise<Rect | null> => {
      const t = step.target;
      if (!t) return Promise.resolve(null);
      if (typeof t === 'function') return Promise.resolve(t()).catch(() => null);
      if (typeof t === 'object') return Promise.resolve(t);
      const ref = targets.current.get(t);
      if (!ref?.current) return Promise.resolve(null);
      return new Promise((resolve) => {
        ref.current!.measureInWindow((x, y, width, height) =>
          resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
        );
      });
    };

    const run = async () => {
      if (!isRefresh) {
        try {
          await step.onBeforeEnter?.();
        } catch {
          // a failing hook shouldn't wedge the tour
        }
      }
      const deadline = Date.now() + measureTimeout;
      const attempt = async () => {
        if (cancelled) return;
        const rect = await measureOnce();
        if (cancelled) return;
        if (!rect && step.target && Date.now() < deadline) {
          retryTimer = setTimeout(attempt, MEASURE_RETRY_MS);
          return;
        }
        if (!rect && step.target && __DEV__) {
          console.warn(
            `[walkthrough] Couldn't measure target for step "${step.id}" — showing it centred.`,
          );
        }
        setTarget(rect);
        setReady(true);
        if (isRefresh) return;
        measuredStepKey.current = stepKey;
        step.onEnter?.();
        latest.current.onStepChange?.(step, index, tour.id);
        if (step.audio != null && !latest.current.muted) {
          try {
            void latest.current.audio?.play(step.audio);
          } catch {
            // ignore adapter failures
          }
        }
      };
      void attempt();
    };

    if (!isRefresh) setReady(false);
    void run();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (!isRefresh) stopAudio();
    };
    // Re-run on a new step or an explicit refresh — not when `step` is merely patched by updateStep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, measureTick]);

  // Rotation / window resize → re-measure.
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', refresh);
    return () => sub.remove();
  }, [refresh]);

  // Muting mid-step silences it immediately.
  useEffect(() => {
    if (muted) stopAudio();
  }, [muted, stopAudio]);

  // Android hardware back.
  useEffect(() => {
    if (!tour || androidBack === 'none') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (androidBack === 'back' && stateRef.current.index > 0) back();
      else if (androidBack === 'stop') stop();
      else skip();
      return true;
    });
    return () => sub.remove();
  }, [tour, androidBack, back, stop, skip]);

  const onBackdropAction = useCallback(
    (action: BackdropPressAction) => {
      if (action === 'next') next();
      else if (action === 'skip') skip();
      else if (action === 'stop') stop();
    },
    [next, skip, stop],
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const value = useMemo<WalkthroughContextValue>(
    () => ({
      start,
      next,
      back,
      goTo,
      skip,
      stop,
      updateStep,
      refresh,
      isActive: !!tour,
      tourId: tour?.id ?? null,
      currentStep: step,
      stepIndex: index,
      totalSteps: tour?.steps.length ?? 0,
      muted,
      setMuted,
      hasSeen,
      markSeen,
      resetSeen,
      registerTarget,
      lastFinishReason,
    }),
    [start, next, back, goTo, skip, stop, updateStep, refresh, tour, step, index, muted, hasSeen, markSeen, resetSeen, registerTarget, lastFinishReason],
  );

  const handRenderer = useMemo(
    () => renderHand ?? ((props: HandRenderProps) => <DefaultHand {...props} />),
    [renderHand],
  );

  const overlay =
    tour && step ? (
      <SpotlightOverlay
        step={step}
        target={target}
        ready={ready}
        theme={stepTheme}
        insets={insets}
        renderTooltip={renderTooltip}
        onBackdropAction={onBackdropAction}
        tooltipProps={{
          stepIndex: index,
          totalSteps: tour.steps.length,
          isFirst: index === 0,
          isLast: index === tour.steps.length - 1,
          labels,
          muted,
          hasAudio: step.audio != null && !!audio,
          next,
          back,
          skip,
          stop,
          toggleMute,
        }}
      />
    ) : null;

  return (
    <WalkthroughContext.Provider value={value}>
      <HandRendererContext.Provider value={handRenderer}>
        {children}
        {overlayHost === 'modal' ? (
          <Modal transparent visible={!!overlay} animationType="none" statusBarTranslucent>
            {overlay}
          </Modal>
        ) : (
          overlay
        )}
      </HandRendererContext.Provider>
    </WalkthroughContext.Provider>
  );
}
