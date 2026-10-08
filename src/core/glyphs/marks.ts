/** The seven marks the user draws, keyed by their combining characters. */
export const MARKS = {
  '̀': 'grave',
  '́': 'acute',
  '̂': 'circumflex',
  '̃': 'tilde',
  '̈': 'diaeresis',
  '̊': 'ring',
  '̧': 'cedilla',
} as const;
export type Mark = keyof typeof MARKS;
