import { bounds, type Contour, type Ring } from '../core/geometry';
import type { PadBox } from './pad/geometry';

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

/** A cell's view: the writing box's full height (so a glyph keeps its place on the baseline), centred on the glyph. */
export function cellViewBox(contours: Contour[], box: PadBox): string {
  const b = bounds(contours), w = box.x1 - box.x0, h = box.y1 - box.y0;
  const cx = Number.isFinite(b.x0) ? (b.x0 + b.x1) / 2 : (box.x0 + box.x1) / 2;
  return `${cx - w / 2} ${-box.y1} ${w} ${h}`;
}
