import { MARKS } from '../core/glyphs/compose';
import type { Project } from '../core/project/schema';
import { characters, DIGITS, LOWERCASE, PUNCTUATION, SUGGESTED_PAIRS, UPPERCASE, VARIANT_PASS } from '../core/project/sets';

/** One thing the Write tab can ask for: a character's default or alternate version, or a joined pair. */
export type Slot = { kind: 'glyph'; ch: string; version: 0 | 1 | 2 } | { kind: 'pair'; pair: string };

export const slotKey = (s: Slot) => (s.kind === 'glyph' ? `${s.ch}#${s.version}` : `pair:${s.pair}`);
export const sameSlot = (a: Slot, b: Slot) => slotKey(a) === slotKey(b);

const NAMES: Record<string, string> = {
  '.': 'a full stop', ',': 'a comma', '!': 'an exclamation mark', '?': 'a question mark', "'": 'an apostrophe',
  '"': 'a quotation mark', '-': 'a hyphen', '(': 'an opening bracket', ')': 'a closing bracket', '&': 'an ampersand',
  ':': 'a colon', ';': 'a semicolon', '@': 'an at sign', '/': 'a slash', '#': 'a hash', $: 'a dollar sign',
  '%': 'a percent sign', '*': 'an asterisk', '+': 'a plus sign', '=': 'an equals sign', '<': 'a less-than sign',
  '>': 'a greater-than sign', '[': 'an opening square bracket', ']': 'a closing square bracket', _: 'an underscore',
  '~': 'a tilde', '`': 'a backtick', '^': 'a caret', '{': 'an opening brace', '}': 'a closing brace',
  '|': 'a vertical bar', '\\': 'a backslash', '£': 'a pound sign', '€': 'a euro sign',
};
const MARK_EXAMPLES: Record<string, string> = {
  grave: 'à', acute: 'é', circumflex: 'ô', tilde: 'ñ', diaeresis: 'ü', ring: 'å', cedilla: 'ç',
};

/** How the character is spoken in prompts and labels: “a lowercase g”, “the number 7”, “a comma”. */
export function describe(ch: string): string {
  if (LOWERCASE.includes(ch)) return `a lowercase ${ch}`;
  if (UPPERCASE.includes(ch)) return `a capital ${ch}`;
  if (DIGITS.includes(ch)) return `the number ${ch}`;
  if (ch in MARKS) {
    const name = MARKS[ch as keyof typeof MARKS];
    return `${name === 'acute' ? 'an' : 'a'} ${name} accent`;
  }
  return NAMES[ch] ?? ch;
}

/** What the grid shows for a character: marks sit on a dotted circle so they're visible on their own. */
export const display = (ch: string) => (ch in MARKS ? `◌${ch}` : ch);

export type Prompt = { title: string; hint?: string };

export function prompt(slot: Slot): Prompt {
  if (slot.kind === 'pair') return { title: `Write ${slot.pair} in one go, joined the way you'd write it.`, hint: 'Your own letters are underneath as a guide.' };
  const { ch, version } = slot;
  if (version > 0) return { title: `Write ${describe(ch)} again.`, hint: 'A little different from last time is good. They take turns in your font.' };
  if (ch in MARKS) {
    const name = MARKS[ch as keyof typeof MARKS];
    return { title: `Write ${describe(ch)} on its own.`, hint: `It's used to make letters like ${MARK_EXAMPLES[name]}. Draw it about the size it sits above a letter.` };
  }
  const title = `Write ${describe(ch)}.`;
  if ('gjpqy'.includes(ch)) return { title, hint: 'Let the tail hang below the line.' };
  if (UPPERCASE.includes(ch) || DIGITS.includes(ch)) return { title, hint: 'Reach up to the dotted line.' };
  if ('bdfhklt'.includes(ch)) return { title, hint: 'Let the tall stroke rise above the dashed line.' };
  if (LOWERCASE.includes(ch)) return { title, hint: 'Sit it on the line and keep it under the dashed one.' };
  if (PUNCTUATION.includes(ch) && ',;'.includes(ch)) return { title, hint: 'Let it dip just below the line.' };
  return { title };
}

/** The order the Write tab walks through: every character, then the variants pass, then joined pairs. */
export function sequence(project: Project): Slot[] {
  const sets = project.settings.sets;
  const out: Slot[] = characters(sets).map((ch) => ({ kind: 'glyph', ch, version: 0 }));
  if (sets.includes('variants')) {
    for (const version of [1, 2] as const) for (const ch of VARIANT_PASS) out.push({ kind: 'glyph', ch, version });
  }
  if (sets.includes('pairs')) {
    const pairs = [...new Set([...SUGGESTED_PAIRS, ...Object.keys(project.pairs)])];
    for (const pair of pairs) out.push({ kind: 'pair', pair });
  }
  return out;
}

export function isDone(project: Project, slot: Slot): boolean {
  if (slot.kind === 'pair') return Boolean(project.pairs[slot.pair]);
  return Boolean(project.glyphs[slot.ch]?.[slot.version]);
}
