import { GRID, type Profile } from './profiles';

/** A spaced glyph as kerning sees it: its profile on the shared grid, sidebearings and advance. */
export type KernGlyph = {
  /** Character(s) it stands for; a pair uses its first character for its left side, last for its right. */
  text: string;
  profile: Profile;
  advance: number;
  lsb: number;
  rsb: number;
};

export type PairGap = { eff: number; minGap: number };

const MIN_CLEARANCE = 24;
const STRENGTH = 0.8;
const MIN_KERN = -300, MAX_KERN = 80;

/**
 * The visual gap between two glyphs set side by side: band by band, the white space from a's ink to b's,
 * with each side's contribution clamped so deep open counters (the inside of a C) don't count as gap.
 */
export function pairGap(a: KernGlyph, b: KernGlyph, depthCap: number): PairGap | null {
  let minGap = Infinity, sum = 0, n = 0;
  for (let i = 0; i < GRID.bands; i++) {
    const ra = a.profile.right[i]!, lb = b.profile.left[i]!;
    if (!Number.isFinite(ra) || !Number.isFinite(lb)) continue;
    const ga = a.advance - ra, gb = lb;
    minGap = Math.min(minGap, ga + gb);
    sum += Math.min(ga, a.rsb + depthCap) + Math.min(gb, b.lsb + depthCap);
    n++;
  }
  return n >= 2 ? { eff: sum / n, minGap } : null;
}

const side = (ch: string) => (/^[A-Z]$/.test(ch) ? 'U' : 'l');
export type ReferenceGaps = Record<'ll' | 'UU' | 'Ul' | 'lU', number>;

/**
 * Kern a pair towards the gap the user's own straight-sided letters make (nn, HH, Hn, nH): a pair that
 * looks looser than that comes together, one that looks tighter opens up, and nothing ever touches.
 */
export function kernValue(a: KernGlyph, b: KernGlyph, refs: ReferenceGaps, xHeight: number): number {
  const gap = pairGap(a, b, 0.6 * xHeight);
  if (!gap) return 0;
  const ref = refs[`${side(a.text.at(-1)!)}${side(b.text[0]!)}` as keyof ReferenceGaps];
  const floor = MIN_CLEARANCE - gap.minGap;
  let k = Math.min(MAX_KERN, Math.max(MIN_KERN, STRENGTH * (ref - gap.eff), floor));
  // Round to a multiple of 5 and drop tiny values, but never below the clearance floor.
  k = Math.round(k / 5) * 5;
  if (k < floor && k + 5 <= MAX_KERN) k += 5;
  return Math.abs(k) < 10 && floor <= 0 ? 0 : k;
}

/** Reference gaps from n and H, or from the straightest-sided drawn glyph of that case when one is missing. */
export function referenceGaps(glyphs: Map<string, KernGlyph & { meanDepth: number }>, xHeight: number): ReferenceGaps {
  const pick = (preferred: string, ofCase: (ch: string) => boolean) => {
    const own = glyphs.get(preferred);
    if (own) return own;
    let best: (KernGlyph & { meanDepth: number }) | undefined;
    for (const [ch, g] of glyphs) if (ofCase(ch) && (!best || g.meanDepth < best.meanDepth)) best = g;
    return best;
  };
  const lower = pick('n', (ch) => /^[a-z]$/.test(ch)), upper = pick('H', (ch) => /^[A-Z]$/.test(ch)) ?? lower;
  const l = lower ?? upper;
  const gap = (x?: KernGlyph, y?: KernGlyph) => (x && y ? pairGap(x, y, 0.6 * xHeight)?.eff ?? 0 : 0);
  return { ll: gap(l, l), UU: gap(upper, upper), Ul: gap(upper, l), lU: gap(l, upper) };
}
