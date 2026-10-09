import { createAudioPlayer, setAudioModeAsync, type AudioSource } from 'expo-audio';
import type { WalkthroughAudioAdapter } from '../types';

export interface ExpoAudioAdapterOptions {
  /** 0–1. Default 1. */
  volume?: number;
  /** Play narration even with the iOS silent switch on. Default true. */
  playsInSilentMode?: boolean;
  /**
   * How long to wait for a clip to actually start playing before treating it
   * as failed (→ TTS fallback in `auto` narration). Covers dead URLs, which
   * often never report an error. Default 5000 ms.
   */
  startTimeoutMs?: number;
  onError?: (error: unknown) => void;
}

/**
 * Audio adapter backed by `expo-audio`. Install `expo-audio` in your app,
 * then:
 *
 *   import { createExpoAudioAdapter } from 'react-native-spotlight-walkthrough/expo-audio';
 *   const audio = createExpoAudioAdapter();
 *   <WalkthroughProvider audio={audio}>
 *
 * Steps then take `audio: require('./assets/step1.m4a')` or `{ uri: 'https://…' }`.
 *
 * `play` resolves once playback has really started and rejects if the clip
 * errors or doesn't start within `startTimeoutMs` — that's what lets the
 * provider fall back to TTS. A play that's superseded (next step, stop, mute)
 * resolves quietly instead of rejecting.
 *
 * One player is created lazily and reused for every step (swapping its source
 * with `replace`) — creating and releasing a player per clip can exhaust
 * Android's MediaCodec pool on long tours.
 */
export function createExpoAudioAdapter(
  options: ExpoAudioAdapterOptions = {},
): WalkthroughAudioAdapter & { release: () => void } {
  const { volume = 1, playsInSilentMode = true, startTimeoutMs = 5000, onError } = options;
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  let modeSet: Promise<void> | null = null;
  let detachWatch: (() => void) | null = null;
  // Bumped on every play/stop so an older play can tell it's been superseded.
  let generation = 0;

  const getPlayer = () => {
    if (!player) {
      player = createAudioPlayer();
      player.volume = volume;
    }
    return player;
  };

  const fail = (error: unknown) => {
    onError?.(error);
    throw error;
  };

  return {
    async play(source) {
      const gen = ++generation;
      detachWatch?.();

      try {
        modeSet ??= setAudioModeAsync({ playsInSilentMode });
        await modeSet;
      } catch (error) {
        // An audio-session hiccup shouldn't stop playback being attempted.
        modeSet = null;
        onError?.(error);
      }
      if (gen !== generation) return;

      const p = getPlayer();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          subscription.remove();
          if (detachWatch === detach) detachWatch = null;
          // Superseded plays resolve quietly — the provider has moved on.
          if (error !== undefined && gen === generation) reject(error);
          else resolve();
        };
        const detach = () => finish();

        const subscription = p.addListener('playbackStatusUpdate', (status) => {
          if (gen !== generation) return finish();
          const statusError = (status as { error?: unknown }).error;
          if (statusError) return finish(new Error(`Audio playback failed: ${String(statusError)}`));
          if (status.playing || status.currentTime > 0) finish();
        });
        const timer = setTimeout(
          () => finish(new Error(`Audio didn't start within ${startTimeoutMs}ms`)),
          startTimeoutMs,
        );
        detachWatch = detach;

        try {
          p.replace(source as AudioSource);
          void p.seekTo(0).catch(() => {});
          p.play();
        } catch (error) {
          finish(error);
        }
      }).catch(fail);
    },

    stop() {
      generation++;
      detachWatch?.();
      try {
        player?.pause();
      } catch (error) {
        onError?.(error);
      }
    },

    release() {
      generation++;
      detachWatch?.();
      try {
        player?.remove();
      } catch (error) {
        onError?.(error);
      }
      player = null;
    },
  };
}
