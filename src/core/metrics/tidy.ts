import { mapContours, type Contour } from '../geometry';
import { category, GUIDES, mainInkBounds, NO_BASELINE_SNAP, type Category } from './categories';

export type References = { X?: number; A?: number; U?: number; N?: number };

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const xHeightOf = (refs: References) => refs.X ?? GUIDES.xHeight;
export const capHeightOf = (refs: References) => refs.U ?? GUIDES.capHeight;

/** Median main-ink top of each sized category, measured on default glyphs after baseline snapping. */
export function references(defaults: Map<string, Contour[]>): References {
  const tops: Record<'X' | 'A' | 'U' | 'N', number[]> = { X: [], A: [], U: [], N: [] };
  for (const [ch, contours] of defaults) {
    const cat = category(ch);
    if (cat !== 'X' && cat !== 'A' && cat !== 'U' && cat !== 'N') continue;
    if (!contours.length) continue;
    const b = mainInkBounds(snapBaseline(ch, contours, GUIDES.xHeight).contours);
    tops[cat].push(b.y1);
  }
  return { X: median(tops.X), A: median(tops.A), U: median(tops.U), N: median(tops.N) };
}

export type Tidied = { contours: Contour[]; scale: number; offLine: boolean };

function snapBaseline(ch: string, contours: Contour[], xHeight: number) {
  if (NO_BASELINE_SNAP.has(ch)) return { contours, offLine: false };
  const bottom = mainInkBounds(contours).y0;
  if (Math.abs(bottom) > 0.25 * xHeight) return { contours, offLine: true };
  return { contours: mapContours(contours, ([x, y]) => [x, y - bottom]), offLine: false };
}

const SIZED: Partial<Record<Category, keyof References>> = { X: 'X', A: 'A', U: 'U', N: 'N' };

/**
 * Pull heights towards the user's own medians without erasing their character: λ = 0 leaves the drawing
 * alone, λ = 1 matches the median exactly, and no glyph is ever scaled by more than 15%.
 */
export function tidyGlyph(ch: string, contours: Contour[], refs: References, lambda: number): Tidied {
  const xHeight = xHeightOf(refs);
  const snapped = snapBaseline(ch, contours, xHeight);
  // Too far off the line to trust its measurements: leave it exactly as drawn and let the grid flag it.
  if (snapped.offLine) return { contours, scale: 1, offLine: true };
  let out = snapped.contours, scale = 1;
  const cat = category(ch), refKey = SIZED[cat], ref = refKey && refs[refKey];
  if (ref !== undefined) {
    const b = mainInkBounds(out);
    if (b.y1 > 0) {
      scale = Math.min(1.15, Math.max(0.85, 1 + lambda * (ref / b.y1 - 1)));
      const cx = (b.x0 + b.x1) / 2;
      out = mapContours(out, ([x, y]) => [cx + (x - cx) * scale, y * scale]);
    }
  } else if (cat === 'D' && refs.X !== undefined) {
    const top = mainInkBounds(out).y1, diff = refs.X - top;
    if (Math.abs(diff) <= 0.25 * xHeight) out = mapContours(out, ([x, y]) => [x, y + lambda * diff]);
  }
  return { contours: out, scale, offLine: snapped.offLine };
}

/** A joined pair: baseline snapped like a letter, scaled by the mean of its two letters' factors. */
export function tidyPair(contours: Contour[], letterScales: [number, number], refs: References): Tidied {
  const xHeight = xHeightOf(refs);
  const snapped = snapBaseline('pair', contours, xHeight);
  const scale = (letterScales[0] + letterScales[1]) / 2;
  const b = mainInkBounds(snapped.contours), cx = (b.x0 + b.x1) / 2;
  return { contours: mapContours(snapped.contours, ([x, y]) => [cx + (x - cx) * scale, y * scale]), scale, offLine: snapped.offLine };
}
