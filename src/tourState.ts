import type { FinishReason, WalkthroughStep, WalkthroughTour } from './types';

// Pure tour state machine — kept free of React so it can be unit-tested in Node.

export interface TourState {
  tour: WalkthroughTour | null;
  index: number;
}

export type TourAction =
  | { type: 'start'; tour: WalkthroughTour; index: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: string | number }
  | { type: 'updateStep'; id: string; patch: Partial<WalkthroughStep> }
  | { type: 'end' };

export const initialTourState: TourState = { tour: null, index: 0 };

/** Resolves a step id or index to an index; -1 if it doesn't exist. */
export function resolveStepIndex(tour: WalkthroughTour, step: string | number): number {
  if (typeof step === 'number') return step >= 0 && step < tour.steps.length ? step : -1;
  return tour.steps.findIndex((s) => s.id === step);
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'start':
      if (action.tour.steps.length === 0) return initialTourState;
      return { tour: action.tour, index: clampIndex(action.index, action.tour) };
    case 'next':
      if (!state.tour) return state;
      // Past the last step → the tour ends.
      if (state.index >= state.tour.steps.length - 1) return initialTourState;
      return { ...state, index: state.index + 1 };
    case 'back':
      if (!state.tour || state.index === 0) return state;
      return { ...state, index: state.index - 1 };
    case 'goTo': {
      if (!state.tour) return state;
      const index = resolveStepIndex(state.tour, action.step);
      return index === -1 ? state : { ...state, index };
    }
    case 'updateStep': {
      if (!state.tour) return state;
      const steps = state.tour.steps.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s));
      return { ...state, tour: { ...state.tour, steps } };
    }
    case 'end':
      return initialTourState;
  }
}

/** How a `next` from the given state would end the tour, or `null` if it just advances. */
export function finishReasonForNext(state: TourState): FinishReason | null {
  if (!state.tour) return null;
  return state.index >= state.tour.steps.length - 1 ? 'completed' : null;
}

export function storageKeyFor(prefix: string, tourId: string): string {
  return `${prefix}${tourId}`;
}

function clampIndex(index: number, tour: WalkthroughTour): number {
  return Math.min(Math.max(index, 0), tour.steps.length - 1);
}
