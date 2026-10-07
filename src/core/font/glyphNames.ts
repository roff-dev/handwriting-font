const NAMED: Record<string, string> = {
  ' ': 'space', '!': 'exclam', '"': 'quotedbl', '#': 'numbersign', $: 'dollar', '%': 'percent', '&': 'ampersand',
  "'": 'quotesingle', '(': 'parenleft', ')': 'parenright', '*': 'asterisk', '+': 'plus', ',': 'comma', '-': 'hyphen',
  '.': 'period', '/': 'slash', ':': 'colon', ';': 'semicolon', '<': 'less', '=': 'equal', '>': 'greater',
  '?': 'question', '@': 'at', '[': 'bracketleft', '\\': 'backslash', ']': 'bracketright', '^': 'asciicircum',
  _: 'underscore', '`': 'grave', '{': 'braceleft', '|': 'bar', '}': 'braceright', '~': 'asciitilde',
  '£': 'sterling', '€': 'Euro', '‘': 'quoteleft', '’': 'quoteright', '“': 'quotedblleft', '”': 'quotedblright',
  '–': 'endash', '—': 'emdash', '…': 'ellipsis', ı: 'dotlessi',
};
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Adobe Glyph List name for a character: letters as themselves, common symbols by name, the rest `uniXXXX`. */
export function glyphName(ch: string): string {
  if (NAMED[ch]) return NAMED[ch];
  if (/^[A-Za-z]$/.test(ch)) return ch;
  if (/^[0-9]$/.test(ch)) return DIGITS[+ch]!;
  return `uni${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
}

export const altName = (ch: string, k: number) => `${glyphName(ch)}.alt${k}`;

/** A joined pair is named after its components, `t_h`, as the AGL does for ligatures. */
export const pairName = (pair: string) => [...pair].map(glyphName).join('_');
