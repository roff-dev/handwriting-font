import { bounds, contourArea, type Bounds, type Contour } from '../geometry';

export const GUIDES = { baseline: 0, xHeight: 480, capHeight: 700, descender: -240 } as const;

/** X: x-height letters. D: descenders. A: ascenders. U: capitals. N: figures. P: everything else. */
export type Category = 'X' | 'D' | 'A' | 'U' | 'N' | 'P';

export function category(ch: string): Category {
  if ('acemnorsuvwxz'.includes(ch)) return 'X';
  if ('gjpqy'.includes(ch)) return 'D';
  if ('bdfhkl'.includes(ch)) return 'A';
  if (/^[A-Z]$/.test(ch)) return 'U';
  if (/^[0-9]$/.test(ch)) return 'N';
  return 'P';
}

/** Shapes that hang off the baseline or float above it, so baseline snapping leaves them alone. */
export const NO_BASELINE_SNAP = new Set([...'gjpqy,;\'"-^`~*']);

export const isCapitalLike = (ch: string) => /^[A-Z0-9]$/.test(ch);

/**
 * The contours that define a glyph's height: every outer contour at least half the size of the largest,
 * so the dots of i, j, ! and ? drop out. Dots measured 12–26% of a glyph's ink, too much for an area
 * share to separate, but never more than 0.31 of the letter's size, at every pen and weight.
 */
export function mainInk(contours: Contour[]): Contour[] {
  const outers = contours
    .filter((c) => contourArea(c) > 0)
    .map((c) => {
      const b = bounds([c]);
      return { c, size: Math.max(b.x1 - b.x0, b.y1 - b.y0) };
    });
  if (!outers.length) return contours;
  const largest = Math.max(...outers.map((o) => o.size));
  return outers.filter((o) => o.size >= 0.5 * largest).map((o) => o.c);
}

// Tidy, composition and the references all ask for the same glyph's main ink; outlines are never mutated.
const measured = new WeakMap<Contour[], Bounds>();

export function mainInkBounds(contours: Contour[]): Bounds {
  let b = measured.get(contours);
  if (!b) measured.set(contours, (b = bounds(mainInk(contours))));
  return b;
}
