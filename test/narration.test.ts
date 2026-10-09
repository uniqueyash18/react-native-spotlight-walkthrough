import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planNarration, speechTextFor } from '../src/narration.ts';
import type { NarrationContext } from '../src/narration.ts';
import type { WalkthroughStep } from '../src/types.ts';

const both: Omit<NarrationContext, 'mode'> = {
  muted: false,
  hasAudioAdapter: true,
  hasSpeechAdapter: true,
};
const withAudio: WalkthroughStep = { id: 'a', title: 'Your profile', message: 'Tap to edit.', audio: 1 };
const textOnly: WalkthroughStep = { id: 't', title: 'Search', message: 'Find parts.' };

test('auto: audio file first, TTS as the fallback', () => {
  assert.deepEqual(planNarration(withAudio, { ...both, mode: 'auto' }), {
    primary: 'audio',
    fallbackToSpeech: true,
    text: 'Your profile. Tap to edit.',
  });
});

test('auto: no audio file → TTS', () => {
  assert.equal(planNarration(textOnly, { ...both, mode: 'auto' }).primary, 'speech');
});

test('auto: audio but no speech adapter → audio without fallback', () => {
  const plan = planNarration(withAudio, { ...both, hasSpeechAdapter: false, mode: 'auto' });
  assert.equal(plan.primary, 'audio');
  assert.equal(plan.fallbackToSpeech, false);
});

test('auto: audio file but no audio adapter → TTS', () => {
  assert.equal(planNarration(withAudio, { ...both, hasAudioAdapter: false, mode: 'auto' }).primary, 'speech');
});

test('audio mode never speaks', () => {
  assert.deepEqual(planNarration(withAudio, { ...both, mode: 'audio' }), {
    primary: 'audio',
    fallbackToSpeech: false,
    text: null,
  });
  assert.equal(planNarration(textOnly, { ...both, mode: 'audio' }).primary, null);
});

test('tts mode ignores audio files', () => {
  const plan = planNarration(withAudio, { ...both, mode: 'tts' });
  assert.equal(plan.primary, 'speech');
  assert.equal(plan.text, 'Your profile. Tap to edit.');
});

test('off and muted are silent', () => {
  assert.equal(planNarration(withAudio, { ...both, mode: 'off' }).primary, null);
  assert.equal(planNarration(withAudio, { ...both, muted: true, mode: 'auto' }).primary, null);
  assert.equal(planNarration(textOnly, { ...both, muted: true, mode: 'tts' }).primary, null);
});

test('a step can override the provider mode', () => {
  assert.equal(planNarration({ ...withAudio, narration: 'tts' }, { ...both, mode: 'audio' }).primary, 'speech');
  assert.equal(planNarration({ ...withAudio, narration: 'off' }, { ...both, mode: 'auto' }).primary, null);
});

test('speak: false opts a step out of TTS, including the fallback', () => {
  const step = { ...withAudio, speak: false as const };
  const plan = planNarration(step, { ...both, mode: 'auto' });
  assert.equal(plan.primary, 'audio');
  assert.equal(plan.fallbackToSpeech, false);
  assert.equal(planNarration({ ...textOnly, speak: false }, { ...both, mode: 'tts' }).primary, null);
});

test('speech text: custom, title + message, punctuation, empty', () => {
  assert.equal(speechTextFor({ id: 'x', title: 'T', speak: 'Custom line' }), 'Custom line');
  assert.equal(speechTextFor({ id: 'x', title: 'Done!', message: 'Bye' }), 'Done! Bye');
  assert.equal(speechTextFor({ id: 'x', title: 'Only title' }), 'Only title');
  assert.equal(speechTextFor({ id: 'x' }), null);
  assert.equal(speechTextFor({ id: 'x', speak: '   ' }), null);
});
