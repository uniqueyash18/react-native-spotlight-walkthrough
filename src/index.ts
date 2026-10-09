export { WalkthroughProvider, type WalkthroughProviderProps } from './WalkthroughProvider';
export { WalkthroughTarget, useWalkthroughTarget, type WalkthroughTargetProps } from './WalkthroughTarget';
export {
  useWalkthrough,
  useWalkthroughTheme,
  type WalkthroughContextValue,
} from './context';

export { DefaultTooltip } from './overlay/DefaultTooltip';
export { defaultTheme, defaultLabels, mergeTheme, withAlpha } from './theme';

// Simulation building blocks + presets, for custom gesture animations.
export {
  useLoopProgress,
  tapPressScale,
  SimHand,
  TapRipple,
  DefaultHand,
  type SimHandProps,
  type TapRippleProps,
} from './simulation/primitives';
export {
  TapSimulation,
  LongPressSimulation,
  SwipeSimulation,
  PinchSimulation,
  type PresetProps,
} from './simulation/presets';

export type {
  Rect,
  RelativePoint,
  Insets,
  SpotlightShape,
  TooltipPlacement,
  SimulationPreset,
  SimulationRenderContext,
  StepSimulation,
  AudioSource,
  BackdropPressAction,
  WalkthroughStep,
  WalkthroughTour,
  StartOptions,
  FinishReason,
  WalkthroughTheme,
  DeepPartial,
  WalkthroughLabels,
  WalkthroughAudioAdapter,
  WalkthroughStorage,
  TooltipRenderProps,
  HandRenderProps,
} from './types';
