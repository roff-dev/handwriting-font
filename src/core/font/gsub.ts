import { writeCoverage, writeLayoutTable, type Feature, type Lookup } from './otl';
import { Writer } from './sfnt';

export type GsubInput = {
  /** Each base glyph id with its alternates: `[alt1]` or `[alt1, alt2]`. */
  variants: { base: number; alts: number[] }[];
  /** Two-letter joined pairs: first and second component ids → the pair glyph. */
  pairs: { glyph: number; first: number; second: number }[];
  /** Glyphs that count as “default” for the cycle: every non-alternate glyph, pairs and the space. */
  neutral: number[];
};

const SINGLE = 1, LIGATURE = 4, CHAINING = 6, EXTENSION = 7;

function singleSubst(map: [number, number][]): Uint8Array {
  const sorted = [...map].sort((a, b) => a[0] - b[0]);
  const w = new Writer();
  w.u16(2);
  const coverageAt = w.slot();
  w.u16(sorted.length);
  for (const [, to] of sorted) w.u16(to);
  w.patch(coverageAt, 0);
  writeCoverage(w, sorted.map(([from]) => from));
  return w.finish();
}

function ligatureSubst(pairs: GsubInput['pairs']): Uint8Array {
  const byFirst = new Map<number, GsubInput['pairs']>();
  for (const p of pairs) byFirst.set(p.first, [...(byFirst.get(p.first) ?? []), p]);
  const firsts = [...byFirst.keys()].sort((a, b) => a - b);
  const w = new Writer();
  w.u16(1);
  const coverageAt = w.slot();
  w.u16(firsts.length);
  const setSlots = firsts.map(() => w.slot());
  w.patch(coverageAt, 0);
  writeCoverage(w, firsts);
  firsts.forEach((first, i) => {
    w.patch(setSlots[i]!, 0);
    const set = w.pos, ligatures = byFirst.get(first)!;
    w.u16(ligatures.length);
    const ligSlots = ligatures.map(() => w.slot());
    ligatures.forEach((lig, k) => {
      w.patch(ligSlots[k]!, set);
      w.u16(lig.glyph);
      w.u16(2);
      w.u16(lig.second);
    });
  });
  return w.finish();
}

/** Chaining context format 3: one backtrack glyph from `after`, one input glyph from `input` → `lookup`. */
function chainOne(after: number[], input: number[], lookup: number): Uint8Array {
  const w = new Writer();
  w.u16(3);
  w.u16(1);
  const backtrackAt = w.slot();
  w.u16(1);
  const inputAt = w.slot();
  w.u16(0);
  w.u16(1);
  w.u16(0);
  w.u16(lookup);
  w.patch(backtrackAt, 0);
  writeCoverage(w, after);
  w.patch(inputAt, 0);
  writeCoverage(w, input);
  return w.finish();
}

/**
 * Letters take turns: each letter picks the variant after the one the previous glyph used, cycling
 * default → alt1 → alt2 → default. The chaining lookup reads the glyph before it, which the same pass
 * has already substituted, so the state carries along the line. Joined pairs run first, as their own
 * `liga` feature, so they form from plain letters and then count as a default glyph for the cycle.
 */
export function makeGsub({ variants, pairs, neutral }: GsubInput): Uint8Array | null {
  const lookups: Lookup[] = [];
  const features: Feature[] = [];
  if (pairs.length) {
    features.push({ tag: 'liga', lookups: [lookups.length] });
    lookups.push({ type: LIGATURE, subtables: [ligatureSubst(pairs)] });
  }
  const withAlt = (k: number) => variants.filter((v) => v.alts[k] !== undefined).map((v): [number, number] => [v.base, v.alts[k]!]);
  const alt1 = withAlt(0), alt2 = withAlt(1);
  if (alt1.length) {
    const alt1Lookup = lookups.length;
    lookups.push({ type: SINGLE, subtables: [singleSubst(alt1)] });
    const chains = [chainOne(neutral, alt1.map(([b]) => b), alt1Lookup)];
    if (alt2.length) {
      const alt2Lookup = lookups.length;
      lookups.push({ type: SINGLE, subtables: [singleSubst(alt2)] });
      chains.push(chainOne(alt1.map(([, a]) => a), alt2.map(([b]) => b), alt2Lookup));
    }
    features.push({ tag: 'calt', lookups: [lookups.length] });
    lookups.push({ type: CHAINING, subtables: chains });
  }
  return lookups.length ? writeLayoutTable(features, lookups, EXTENSION) : null;
}
