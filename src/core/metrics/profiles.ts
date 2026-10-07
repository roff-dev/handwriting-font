import { flatten, type Contour, type Ring } from '../geometry';

/** Leftmost and rightmost ink in each horizontal band, or ±Infinity where a band has no ink. */
export type Profile = { left: Float64Array; right: Float64Array };

/**
 * Intersect every outline edge with the horizontal lines y = y0 + (b + 0.5) · step. Each edge only visits
 * the bands it crosses, so the cost is the number of crossings rather than bands × edges.
 */
function scan(rings: Ring[], y0: number, step: number, n: number, yMin = -Infinity, yMax = Infinity): Profile {
  const left = new Float64Array(n).fill(Infinity), right = new Float64Array(n).fill(-Infinity);
  for (const ring of rings) for (let i = 0, len = ring.length; i < len; i++) {
    const p = ring[i]!, q = ring[(i + 1) % len]!;
    if (p[1] === q[1]) continue;
    const lo = Math.min(p[1], q[1]), hi = Math.max(p[1], q[1]);
    const first = Math.max(0, Math.ceil((lo - y0) / step - 0.5)), last = Math.min(n - 1, Math.floor((hi - y0) / step - 0.5));
    for (let b = first; b <= last; b++) {
      const y = y0 + (b + 0.5) * step;
      if (y < yMin || y > yMax || p[1] > y === q[1] > y) continue;
      const x = p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]);
      if (x < left[b]!) left[b] = x;
      if (x > right[b]!) right[b] = x;
    }
  }
  return { left, right };
}

export const SPACING_BANDS = 48;

/** Profile across a zone (baseline to x-height or cap height), sampled at band centres. */
export function zoneProfile(contours: Contour[], y0: number, y1: number): Profile {
  return scan(contours.map((c) => flatten(c, 8)), y0, (y1 - y0) / SPACING_BANDS, SPACING_BANDS);
}

export const GRID = { y0: -400, step: 10, bands: 150 } as const;

/**
 * Profile on one fixed grid shared by every glyph, so a kerning pair compares band i with band i
 * directly. Computed once per glyph instead of once per pair: 1.4 s → 0.16 s in the spike.
 */
export function gridProfile(contours: Contour[], yMin: number, yMax: number): Profile {
  return scan(contours.map((c) => flatten(c, 8)), GRID.y0, GRID.step, GRID.bands, yMin, yMax);
}
