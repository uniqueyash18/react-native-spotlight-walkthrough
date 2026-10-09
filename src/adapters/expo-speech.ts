import * as Speech from 'expo-speech';
import type { SpeechOptions, WalkthroughSpeechAdapter } from '../types';

export interface ExpoSpeechAdapterOptions {
  /** Default language when the provider doesn't pass `speechLanguage`. */
  language?: string;
  /** 0.1–2, 1 = normal. */
  rate?: number;
  /** 0.5–2, 1 = normal. */
  pitch?: number;
  /** Voice identifier from `Speech.getAvailableVoicesAsync()`. */
  voice?: string;
  volume?: number;
  onError?: (error: unknown) => void;
}

/**
 * Text-to-speech adapter backed by `expo-speech`. Install `expo-speech` in
 * your app, then:
 *
 *   import { createExpoSpeechAdapter } from 'react-native-spotlight-walkthrough/expo-speech';
 *   const speech = createExpoSpeechAdapter({ rate: 0.95 });
 *   <WalkthroughProvider speech={speech} speechLanguage={i18n.language}>
 */
export function createExpoSpeechAdapter(
  options: ExpoSpeechAdapterOptions = {},
): WalkthroughSpeechAdapter {
  const { language, rate, pitch, voice, volume, onError } = options;
  return {
    speak(text: string, speakOptions?: SpeechOptions) {
      // Cut off anything still being read from the previous step.
      void Speech.stop().catch(() => {});
      Speech.speak(text, {
        language: speakOptions?.language ?? language,
        rate,
        pitch,
        voice,
        volume,
        onError: (error) => onError?.(error),
      });
    },
    stop() {
      return Speech.stop().catch((error) => onError?.(error));
    },
  };
}
