import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  finishReasonForNext,
  initialTourState,
  resolveStepIndex,
  tourReducer,
} from '../src/tourState.ts';
import type { WalkthroughTour } from '../src/types.ts';

const tour: WalkthroughTour = {
  id: 'demo',
  steps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
};

test('start clamps the index', () => {
  assert.equal(tourReducer(initialTourState, { type: 'start', tour, index: 9 }).index, 2);
  assert.equal(tourReducer(initialTourState, { type: 'start', tour, index: -3 }).index, 0);
});

test('a tour with no steps never starts', () => {
  const s = tourReducer(initialTourState, { type: 'start', tour: { id: 'x', steps: [] }, index: 0 });
  assert.equal(s.tour, null);
});

test('next advances, then ends after the last step', () => {
  let s = tourReducer(initialTourState, { type: 'start', tour, index: 0 });
  s = tourReducer(s, { type: 'next' });
  assert.equal(s.index, 1);
  assert.equal(finishReasonForNext(s), null);
  s = tourReducer(s, { type: 'next' });
  assert.equal(finishReasonForNext(s), 'completed');
  s = tourReducer(s, { type: 'next' });
  assert.equal(s.tour, null);
});

test('back stops at the first step', () => {
  const s = tourReducer(tourReducer(initialTourState, { type: 'start', tour, index: 0 }), {
    type: 'back',
  });
  assert.equal(s.index, 0);
});

test('goTo accepts ids and indexes and ignores unknown ones', () => {
  let s = tourReducer(initialTourState, { type: 'start', tour, index: 0 });
  s = tourReducer(s, { type: 'goTo', step: 'c' });
  assert.equal(s.index, 2);
  s = tourReducer(s, { type: 'goTo', step: 1 });
  assert.equal(s.index, 1);
  assert.equal(tourReducer(s, { type: 'goTo', step: 'nope' }), s);
  assert.equal(resolveStepIndex(tour, 5), -1);
});

test('updateStep patches only the matching step', () => {
  let s = tourReducer(initialTourState, { type: 'start', tour, index: 0 });
  s = tourReducer(s, { type: 'updateStep', id: 'b', patch: { message: 'Hello' } });
  assert.equal(s.tour?.steps[1].message, 'Hello');
  assert.equal(s.tour?.steps[0].message, undefined);
  assert.equal(tour.steps[1].message, undefined, 'original tour is not mutated');
});

test('actions without a running tour are no-ops', () => {
  for (const action of [{ type: 'next' }, { type: 'back' }, { type: 'goTo', step: 0 }] as const) {
    assert.equal(tourReducer(initialTourState, action), initialTourState);
  }
});
