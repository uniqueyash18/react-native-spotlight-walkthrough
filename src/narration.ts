import type { NarrationMode, WalkthroughStep } from './types';

// Pure narration decisions — kept free of React Native so they can be unit-tested in Node.

export interface NarrationPlan {
  /** What to start with. `null` = stay silent. */
  primary: 'audio' | 'speech' | null;
  /** Speak `text` if the audio file fails to load / play. */
  fallbackToSpeech: boolean;
  /** Text for TTS (step.speak, else title + message). */
  text: string | null;
}

export interface NarrationContext {
  mode: NarrationMode;
  muted: boolean;
  hasAudioAdapter: boolean;
  hasSpeechAdapter: boolean;
}

const SILENT: NarrationPlan = { primary: null, fallbackToSpeech: false, text: null };

/** The text TTS reads for a step: `speak` if set, otherwise title and message. */
export function speechTextFor(step: WalkthroughStep): string | null {
  if (step.speak === false) return null;
  if (typeof step.speak === 'string') return step.speak.trim() || null;
  const parts = [step.title, step.message]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    // Add a pause between title and message unless the title already ends a sentence.
    .map((p, i, all) => (i < all.length - 1 && !/[.!?。؟]$/.test(p) ? `${p}.` : p));
  return parts.length ? parts.join(' ') : null;
}

/**
 * Decides how a step is narrated:
 * - `off` (or muted) → silent
 * - `audio` → the step's audio file only
 * - `tts`   → always speak the step's text, ignoring audio files
 * - `auto`  → the audio file if there is one, falling back to TTS when there
 *             isn't or when it fails
 * A step's own `narration` overrides the provider's mode.
 */
export function planNarration(step: WalkthroughStep, ctx: NarrationContext): NarrationPlan {
  const mode = step.narration ?? ctx.mode;
  if (ctx.muted || mode === 'off') return SILENT;

  const text = ctx.hasSpeechAdapter ? speechTextFor(step) : null;
  const canPlayAudio = step.audio != null && ctx.hasAudioAdapter;
  const canSpeak = text != null;

  switch (mode) {
    case 'audio':
      return canPlayAudio ? { primary: 'audio', fallbackToSpeech: false, text: null } : SILENT;
    case 'tts':
      return canSpeak ? { primary: 'speech', fallbackToSpeech: false, text } : SILENT;
    case 'auto':
      if (canPlayAudio) return { primary: 'audio', fallbackToSpeech: canSpeak, text };
      return canSpeak ? { primary: 'speech', fallbackToSpeech: false, text } : SILENT;
  }
}
