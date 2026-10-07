import { Writer } from './sfnt';

export const DEFAULT_FAMILY = 'My Hand';
export const STYLE = 'Regular';
export const VERSION = 'Version 1.000';
export const MAX_FAMILY = 31;
export const MAX_DESIGNER = 64;

/** Returns the message to show, or null when the family name is usable. */
export function validateFamily(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Give your font a name.';
  if (name.length > MAX_FAMILY) return `Up to ${MAX_FAMILY} characters.`;
  if (!/^[A-Za-z0-9 ]+$/.test(name)) return 'Use letters, numbers and spaces only.';
  if (!/^[A-Za-z]/.test(name)) return 'Start with a letter.';
  return null;
}

export const cleanFamily = (raw: string) => raw.trim().replace(/\s+/g, ' ');

/** The family is already limited to ASCII letters, digits and spaces, so only the spaces need removing. */
export const postScriptName = (family: string) => `${cleanFamily(family).replace(/ /g, '')}-${STYLE}`;

export type FontNames = { family: string; designer?: string; date: Date };

export function nameRecords({ family: rawFamily, designer, date }: FontNames): Map<number, string> {
  const family = cleanFamily(rawFamily);
  const author = designer?.trim().slice(0, MAX_DESIGNER) || '';
  const day = date.toISOString().slice(0, 10);
  const records = new Map<number, string>([
    [0, `© ${date.getUTCFullYear()} ${author || 'the author'}. Made with Handwriting Font Maker.`],
    [1, family],
    [2, STYLE],
    [3, `HFM: ${family} ${STYLE}: ${day}`],
    [4, `${family} ${STYLE}`],
    [5, VERSION],
    [6, postScriptName(family)],
    [16, family],
    [17, STYLE],
  ]);
  if (author) records.set(9, author);
  return records;
}

const WINDOWS = { platform: 3, encoding: 1, language: 0x409 };
const MAC = { platform: 1, encoding: 0, language: 0 };

/** Mac Roman bytes for ASCII plus ©, or null when the text needs anything else (the record is then Windows-only). */
function macRoman(text: string): number[] | null {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 128) out.push(c);
    else if (c === 0xa9) out.push(0xa9);
    else return null;
  }
  return out;
}

function utf16(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out.push(c >> 8, c & 255);
  }
  return out;
}

/** A format-0 `name` table with Windows (3,1) records for every ID and Mac Roman records where the text allows. */
export function makeNameTable(names: FontNames): Uint8Array {
  const rows: { platform: number; encoding: number; language: number; id: number; bytes: number[] }[] = [];
  for (const [id, text] of nameRecords(names)) {
    const mac = macRoman(text);
    if (mac) rows.push({ ...MAC, id, bytes: mac });
    rows.push({ ...WINDOWS, id, bytes: utf16(text) });
  }
  rows.sort((a, b) => a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.id - b.id);
  const w = new Writer();
  w.u16(0);
  w.u16(rows.length);
  w.u16(6 + rows.length * 12);
  let offset = 0;
  for (const r of rows) {
    w.u16(r.platform);
    w.u16(r.encoding);
    w.u16(r.language);
    w.u16(r.id);
    w.u16(r.bytes.length);
    w.u16(offset);
    offset += r.bytes.length;
  }
  for (const r of rows) w.raw(r.bytes);
  return w.finish();
}
