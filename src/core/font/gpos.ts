import { writeClassDef, writeCoverage, writeLayoutTable } from './otl';
import { Writer } from './sfnt';

export type ClassKerning = {
  /** Glyph id → class as the first glyph of a pair. */
  left: Map<number, number>;
  /** Glyph id → class as the second glyph of a pair. */
  right: Map<number, number>;
  leftCount: number;
  rightCount: number;
  values: Int16Array;
};

const PAIR = 2, EXTENSION = 9, X_ADVANCE = 0x0004;

/** Leaves room for the coverage and class definitions behind 16-bit offsets in the same subtable. */
export const MAX_MATRIX_BYTES = 56_000;

/** PairPos format 2 for the left classes in `rows`, renumbered 1…n inside the subtable (row 0 stays empty). */
function pairPos(k: ClassKerning, rows: number[]): Uint8Array {
  const local = new Map(rows.map((c, i) => [c, i + 1]));
  const left = new Map<number, number>();
  for (const [glyph, c] of k.left) if (local.has(c)) left.set(glyph, local.get(c)!);
  const w = new Writer();
  w.u16(2);
  const coverageAt = w.slot();
  w.u16(X_ADVANCE);
  w.u16(0);
  const leftAt = w.slot(), rightAt = w.slot();
  w.u16(rows.length + 1);
  w.u16(k.rightCount);
  for (let c2 = 0; c2 < k.rightCount; c2++) w.i16(0);
  for (const row of rows) for (let c2 = 0; c2 < k.rightCount; c2++) w.i16(k.values[row * k.rightCount + c2]!);
  w.patch(coverageAt, 0);
  writeCoverage(w, [...left.keys()]);
  w.patch(leftAt, 0);
  writeClassDef(w, left);
  w.patch(rightAt, 0);
  writeClassDef(w, k.right);
  return w.finish();
}

/**
 * Class-based kerning. The matrix grows with the square of the class count and sits behind 16-bit
 * offsets, so a big one is split by left class into several subtables reached through Extension lookups.
 */
export function makeGpos(k: ClassKerning, maxMatrixBytes = MAX_MATRIX_BYTES): Uint8Array {
  const rowsPerTable = Math.max(1, Math.floor(maxMatrixBytes / (2 * k.rightCount)) - 1);
  const used = [...new Set(k.left.values())].filter((c) => c > 0).sort((a, b) => a - b);
  const groups: number[][] = [];
  for (let i = 0; i < used.length; i += rowsPerTable) groups.push(used.slice(i, i + rowsPerTable));
  const subtables = groups.map((rows) => pairPos(k, rows));
  return writeLayoutTable([{ tag: 'kern', lookups: [0] }], [{ type: PAIR, subtables, extension: groups.length > 1 }], EXTENSION);
}

/** Legacy `kern` format 0, for apps that ignore GPOS (classic GDI). At most 10,920 pairs fit one subtable. */
export const MAX_LEGACY_PAIRS = 10_920;

export function makeLegacyKern(pairs: [left: number, right: number, value: number][]): Uint8Array {
  const chosen = [...pairs].sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])).slice(0, MAX_LEGACY_PAIRS);
  chosen.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = chosen.length, selector = n ? Math.floor(Math.log2(n)) : 0, range = n ? 2 ** selector * 6 : 0;
  const w = new Writer();
  w.u16(0);
  w.u16(1);
  w.u16(0);
  w.u16(14 + n * 6);
  w.u16(0x0001);
  w.u16(n);
  w.u16(range);
  w.u16(selector);
  w.u16(n * 6 - range);
  for (const [l, r, v] of chosen) {
    w.u16(l);
    w.u16(r);
    w.i16(v);
  }
  return w.finish();
}
