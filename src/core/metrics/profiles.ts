import { flatten, type Contour, type Ring } from '../geometry';

/** Leftmost and rightmost ink in each horizontal band, or ±Infinity where a band has no ink. */
export type Profile = { left: Float64Array; right: Float64Array };

function scan(rings: Ring[], bandY: (b: number) => number, n: number, skip?: (y: number) => boolean): Profile {
  const left = new Float64Array(n).fill(Infinity), right = new Float64Array(n).fill(-Infinity);
  for (let b = 0; b < n; b++) {
    const y = bandY(b);
    if (skip?.(y)) continue;
    for (const ring of rings) for (let i = 0, len = ring.length; i < len; i++) {
      const p = ring[i]!, q = ring[(i + 1) % len]!;
      if (p[1] > y === q[1] > y) continue;
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
  const rings = contours.map((c) => flatten(c, 8));
  return scan(rings, (b) => y0 + ((b + 0.5) / SPACING_BANDS) * (y1 - y0), SPACING_BANDS);
}

export const GRID = { y0: -400, step: 10, bands: 150 } as const;

/**
 * Profile on one fixed grid shared by every glyph, so a kerning pair compares band i with band i
 * directly. Computed once per glyph instead of once per pair: 1.4 s → 0.16 s in the spike.
 */
export function gridProfile(contours: Contour[], yMin: number, yMax: number): Profile {
  const rings = contours.map((c) => flatten(c, 8));
  return scan(rings, (b) => GRID.y0 + (b + 0.5) * GRID.step, GRID.bands, (y) => y < yMin || y > yMax);
}
