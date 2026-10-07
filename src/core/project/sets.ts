import { MARKS } from '../glyphs/compose';

export type SetId = 'standard' | 'extras' | 'accents' | 'variants' | 'pairs';

const range = (from: string, to: string) =>
  Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(from.charCodeAt(0) + i));

export const LOWERCASE = range('a', 'z');
export const UPPERCASE = range('A', 'Z');
export const DIGITS = range('0', '9');
export const PUNCTUATION = [...'.,!?\'"-()&:;@/'];
/** The default flow: enough for ordinary English text, email addresses and links. */
export const STANDARD = [...LOWERCASE, ...UPPERCASE, ...DIGITS, ...PUNCTUATION];
export const EXTRAS = [...'#$%*+=<>[]_~`^{}|\\£€'];
export const ACCENT_MARKS = Object.keys(MARKS);
/** The twelve most frequent letters get the guided “twice more” pass. */
export const VARIANT_PASS = [...'etaoinshrdlu'];
/** The twelve most frequent English letter pairs (Norvig, Mayzner revisited). */
export const SUGGESTED_PAIRS = ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es'];
export const DOUBLED_PAIRS = ['ll', 'ss', 'ee', 'oo', 'tt'];
export const MAX_PAIRS = 48;
export const MIN_TO_EXPORT = LOWERCASE;

export const canHaveVariants = (ch: string) => /^[A-Za-z0-9]$/.test(ch);
export const isValidPair = (pair: string) => /^[A-Za-z][a-z]$/.test(pair);

/** Characters the Write tab asks for, in order, for the chosen sets. */
export function characters(sets: SetId[]): string[] {
  const out = [...STANDARD];
  if (sets.includes('extras')) out.push(...EXTRAS);
  if (sets.includes('accents')) out.push(...ACCENT_MARKS);
  return out;
}
