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
import { planNarration } from './narration';
import { SpotlightOverlay } from './overlay/SpotlightOverlay';
import { HandRendererContext, DefaultHand } from './simulation/primitives';
import { scrollTargetIntoView } from './scroll';
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
  NarrationMode,
  Rect,
  StartOptions,
  TooltipRenderProps,
  WalkthroughAudioAdapter,
  WalkthroughLabels,
  WalkthroughSpeechAdapter,
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
  /** Text-to-speech. See `react-native-spotlight-walkthrough/expo-speech`. */
  speech?: WalkthroughSpeechAdapter;
  /** Language passed to `speech.speak`, e.g. `en-US` / `ar-SA`. */
  speechLanguage?: string;
  /**
   * `auto` (default) — audio file, TTS when a step has none or it fails ·
   * `audio` — files only · `tts` — always TTS · `off` — silent.
   * Steps can override it with `step.narration`; change it at runtime with
   * `useWalkthrough().setNarration`. A new value of this prop also resets it.
   */
  narration?: NarrationMode;
  /** Start muted. The user can toggle it from the tooltip (theme.audio.showMuteButton). */
  initiallyMuted?: boolean;
  /** An audio file failed — called before falling back to TTS (in `auto`). */
  onAudioError?: (error: unknown, step: WalkthroughStep) => void;

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
  /**
   * Scroll each target into view (inside its WalkthroughScrollView /
   * WalkthroughScrollContainer / scrollRef) before spotlighting it. Default true.
   */
  autoScroll?: boolean;
  /** Gap kept between a scrolled-to target and the visible edge. Default 16. */
  scrollMargin?: number;
  /** Room kept beside a scrolled-to target for the tooltip. Default 180. */
  tooltipReserve?: number;
  /**
   * After scrolling, the target is re-measured until it stops moving; this
   * caps how long that waits, ms. Default 1200.
   */
  scrollSettleMs?: number;

  onStart?: (tourId: string) => void;
  onStepChange?: (step: WalkthroughStep, index: number, tourId: string) => void;
  onFinish?: (tourId: string, reason: FinishReason) => void;
}

const ZERO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };
const MEASURE_RETRY_MS = 100;
const SETTLE_POLL_MS = 80;

const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

export function WalkthroughProvider({
  children,
  theme: themeOverride,
  labels: labelsOverride,
  audio,
  speech,
  speechLanguage,
  narration: narrationProp = 'auto',
  initiallyMuted = false,
  onAudioError,
  storage,
  storageKeyPrefix = 'walkthrough_seen_',
  renderTooltip,
  renderHand,
  overlayHost = 'root',
  insets: insetsOverride,
  androidBack = 'skip',
  measureTimeout = 2000,
  autoScroll = true,
  scrollMargin = 16,
  tooltipReserve = 180,
  scrollSettleMs = 1200,
  onStart,
  onStepChange,
  onFinish,
}: WalkthroughProviderProps) {
  const [state, dispatch] = useReducer(tourReducer, initialTourState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [muted, setMuted] = useState(initiallyMuted);
  const [narration, setNarration] = useState<NarrationMode>(narrationProp);
  useEffect(() => setNarration(narrationProp), [narrationProp]);
  const [target, setTarget] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [measureTick, setMeasureTick] = useState(0);
  const [lastFinishReason, setLastFinishReason] = useState<FinishReason | null>(null);

  const targets = useRef(
    new Map<
      string,
      { ref: React.RefObject<View | null>; scrollChain: readonly React.RefObject<unknown>[] }
    >(),
  );
  // True while a step's target is being resolved. A refresh requested then
  // (e.g. the scroll-end event from our own scrollTo, or content shifting) is
  // queued and runs once the measurement finishes, rather than restarting it.
  const measuring = useRef(false);
  const refreshQueued = useRef(false);
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const insets = insetsOverride ?? safeAreaInsets ?? ZERO_INSETS;

  // Latest callbacks / adapters without re-running effects when they change identity.
  const latest = useRef({
    onStart, onStepChange, onFinish, onAudioError, audio, speech, speechLanguage, storage, muted, narration,
  });
  latest.current = {
    onStart, onStepChange, onFinish, onAudioError, audio, speech, speechLanguage, storage, muted, narration,
  };

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

  // Bumped whenever narration stops or restarts, so a late audio failure from
  // a previous step can't start TTS over the current one.
  const narrationGen = useRef(0);

  const stopAudio = useCallback(() => {
    narrationGen.current++;
    const { audio: a, speech: sp } = latest.current;
    for (const stopFn of [() => a?.stop(), () => sp?.stop()]) {
      try {
        void Promise.resolve(stopFn()).catch(() => {});
      } catch {
        // ignore adapter failures
      }
    }
  }, []);

  const narrate = useCallback(
    (forStep: WalkthroughStep) => {
      stopAudio();
      const gen = narrationGen.current;
      const { audio: a, speech: sp, speechLanguage: language } = latest.current;
      const plan = planNarration(forStep, {
        mode: latest.current.narration,
        muted: latest.current.muted,
        hasAudioAdapter: !!a,
        hasSpeechAdapter: !!sp,
      });

      const speak = () => {
        if (gen !== narrationGen.current || !plan.text || !sp) return;
        try {
          void Promise.resolve(sp.speak(plan.text, { language })).catch(() => {});
        } catch {
          // ignore adapter failures
        }
      };

      if (plan.primary === 'speech') {
        speak();
      } else if (plan.primary === 'audio' && a) {
        const onFail = (error: unknown) => {
          if (gen !== narrationGen.current) return;
          latest.current.onAudioError?.(error, forStep);
          if (plan.fallbackToSpeech) speak();
        };
        try {
          void Promise.resolve(a.play(forStep.audio)).catch(onFail);
        } catch (error) {
          onFail(error);
        }
      }
    },
    [stopAudio],
  );

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
  const refresh = useCallback(() => {
    if (measuring.current) refreshQueued.current = true;
    else setMeasureTick((n) => n + 1);
  }, []);

  const registerTarget = useCallback(
    (id: string, ref: React.RefObject<View | null>, scrollChain: readonly React.RefObject<unknown>[] = []) => {
      const entry = { ref, scrollChain };
      targets.current.set(id, entry);
      return () => {
        if (targets.current.get(id) === entry) targets.current.delete(id);
      };
    },
    [],
  );

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
      const view = targets.current.get(t)?.ref.current;
      if (!view) return Promise.resolve(null);
      return new Promise((resolve) => {
        view.measureInWindow((x, y, width, height) =>
          resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
        );
      });
    };

    // Scrolls a registered target into view through each enclosing scroll
    // container, innermost first; resolves true if anything moved.
    const scrollIntoView = async (): Promise<boolean> => {
      if (!(step.autoScroll ?? autoScroll) || typeof step.target !== 'string') return false;
      const entry = targets.current.get(step.target);
      const view = entry?.ref.current;
      if (!entry || !view) return false;
      const chain = step.scrollRef
        ? [step.scrollRef, ...entry.scrollChain.filter((c) => c !== step.scrollRef)]
        : entry.scrollChain;
      let moved = false;
      for (const container of chain) {
        if (!container.current) continue;
        try {
          const didScroll = await scrollTargetIntoView(view, container.current, {
            insets,
            margin: scrollMargin,
            tooltipReserve,
          });
          moved = moved || didScroll;
        } catch {
          // an unusable container shouldn't stop the outer ones
        }
      }
      return moved;
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, ms);
      });
    // Scroll animations differ by platform and distance — poll until two
    // consecutive measurements agree instead of trusting a fixed delay.
    const measureWhenSettled = async (fallback: Rect): Promise<Rect | null> => {
      const deadline = Date.now() + scrollSettleMs;
      let previous: Rect | null = null;
      await wait(SETTLE_POLL_MS);
      while (!cancelled) {
        const current = await measureOnce();
        if (current && previous && sameRect(current, previous)) return current;
        if (Date.now() >= deadline) return current ?? fallback;
        previous = current;
        await wait(SETTLE_POLL_MS);
      }
      return null;
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
      let scrolls = 0;
      const attempt = async () => {
        if (cancelled) return;
        let rect = await measureOnce();
        if (cancelled) return;
        if (!rect && step.target && Date.now() < deadline) {
          retryTimer = setTimeout(attempt, MEASURE_RETRY_MS);
          return;
        }
        // Bring it on screen first, then measure where it settled. A second
        // pass catches layouts that shift while scrolling (sticky headers…).
        // Refreshes (user scrolled, layout shifted) only re-measure — they
        // never scroll, so the tour doesn't fight the user.
        while (!isRefresh && rect && scrolls < 2 && (await scrollIntoView())) {
          if (scrolls === 0) setScrolling(true);
          scrolls++;
          rect = (await measureWhenSettled(rect)) ?? rect;
          if (cancelled) return;
        }
        measuring.current = false;
        if (scrolls > 0) setScrolling(false);
        if (refreshQueued.current) {
          refreshQueued.current = false;
          // Re-measure once more after this one lands (measuredStepKey is set
          // below, so it runs as a refresh: no onEnter / narration replay).
          setTimeout(() => setMeasureTick((n) => n + 1), 0);
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
        narrate(step);
      };
      void attempt();
    };

    if (!isRefresh) {
      setReady(false);
      refreshQueued.current = false;
    }
    measuring.current = true;
    void run();
    return () => {
      cancelled = true;
      measuring.current = false;
      setScrolling(false);
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

  // Muting or switching mode mid-step takes effect immediately: silence, or
  // restart the current step's narration in the new mode.
  const narrationKey = `${muted}:${narration}`;
  const lastNarrationKey = useRef(narrationKey);
  useEffect(() => {
    if (lastNarrationKey.current === narrationKey) return;
    lastNarrationKey.current = narrationKey;
    const current = stateRef.current;
    const currentStep = current.tour?.steps[current.index];
    if (currentStep && ready) narrate(currentStep);
    else stopAudio();
  }, [narrationKey, ready, narrate, stopAudio]);

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
      narration,
      setNarration,
      hasSeen,
      markSeen,
      resetSeen,
      registerTarget,
      lastFinishReason,
    }),
    [start, next, back, goTo, skip, stop, updateStep, refresh, tour, step, index, muted, narration, hasSeen, markSeen, resetSeen, registerTarget, lastFinishReason],
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
        collapsed={scrolling}
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
          // Whether this step would make a sound if unmuted — drives the mute button.
          hasAudio:
            planNarration(step, {
              mode: narration,
              muted: false,
              hasAudioAdapter: !!audio,
              hasSpeechAdapter: !!speech,
            }).primary !== null,
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
