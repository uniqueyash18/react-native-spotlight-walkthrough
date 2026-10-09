import { createAudioPlayer, setAudioModeAsync, type AudioSource } from 'expo-audio';
import type { WalkthroughAudioAdapter } from '../types';

export interface ExpoAudioAdapterOptions {
  /** 0–1. Default 1. */
  volume?: number;
  /** Play narration even with the iOS silent switch on. Default true. */
  playsInSilentMode?: boolean;
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
 * One player is created lazily and reused for every step (swapping its source
 * with `replace`) — creating and releasing a player per clip can exhaust
 * Android's MediaCodec pool on long tours.
 */
export function createExpoAudioAdapter(
  options: ExpoAudioAdapterOptions = {},
): WalkthroughAudioAdapter & { release: () => void } {
  const { volume = 1, playsInSilentMode = true, onError } = options;
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  let modeSet: Promise<void> | null = null;
  // Bumped on every play/stop so a play still awaiting the audio mode can tell
  // it's been superseded and bail instead of talking over the next step.
  let generation = 0;

  const getPlayer = () => {
    if (!player) {
      player = createAudioPlayer();
      player.volume = volume;
    }
    return player;
  };

  return {
    async play(source) {
      const gen = ++generation;
      try {
        modeSet ??= setAudioModeAsync({ playsInSilentMode });
        await modeSet;
        if (gen !== generation) return;
        const p = getPlayer();
        p.replace(source as AudioSource);
        await p.seekTo(0);
        if (gen !== generation) return;
        p.play();
      } catch (error) {
        onError?.(error);
      }
    },
    stop() {
      generation++;
      try {
        player?.pause();
      } catch (error) {
        onError?.(error);
      }
    },
    release() {
      generation++;
      try {
        player?.remove();
      } catch (error) {
        onError?.(error);
      }
      player = null;
    },
  };
}
