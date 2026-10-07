import type { Contour, Ring } from '../core/geometry';

const n = (v: number) => Math.round(v * 10) / 10;

/** Fitted contours as an SVG path in font units (y up; flip it with the viewBox transform). */
export function contourPathData(contours: Contour[]): string {
  let d = '';
  for (const c of contours) {
    if (!c.length) continue;
    d += `M${n(c[0]![0][0])} ${n(c[0]![0][1])}`;
    for (const [, c1, c2, p] of c) d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p[0])} ${n(p[1])}`;
    d += 'Z';
  }
  return d;
}

export function ringPathData(rings: Ring[]): string {
  return rings.map((r) => r.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('') + 'Z').join('');
}
