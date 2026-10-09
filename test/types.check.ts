// Compile-time checks, run by `npm run typecheck`. Nothing here executes.
import type { DeepPartial, WalkthroughStep, WalkthroughTheme } from '../src/types';

// A single nested field can be overridden without restating its siblings.
export const partialTheme: DeepPartial<WalkthroughTheme> = {
  accentColor: '#BC4E2C',
  tooltip: { maxWidth: 420 },
  spotlight: { ring: { color: '#22C55E' } },
  text: { title: { color: '#1C0A03' } },
};

export const stepTheme: WalkthroughStep = {
  id: 'x',
  theme: { spotlight: { ring: { color: '#22C55E' } }, buttons: { nextText: { fontSize: 12 } } },
};

// Style objects stay style objects (not deep-partial'd into nonsense).
export const styled: DeepPartial<WalkthroughTheme> = {
  tooltip: { style: { borderWidth: 1, borderColor: '#eee' } },
};
