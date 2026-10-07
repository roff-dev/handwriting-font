import { Clipper, FillRule, type Paths64 } from '@countertype/clipper2-ts';
import { ringArea, type Point, type Ring } from '../geometry';

// Clipper2 works on integers; 1/64 of a font unit keeps the union far inside the curve-fit tolerance.
const SCALE = 64;
const MIN_AREA = 4;

/**
 * Merge every stroke outline into clean, non-overlapping rings. Almost every perfect-freehand outline
 * crosses itself, so writing them to a font directly would render differently under each fill rule.
 */
export function unionRings(polygons: Ring[]): Ring[] {
  const paths: Paths64 = [];
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    paths.push(poly.map(([x, y]) => ({ x: Math.round(x * SCALE), y: Math.round(y * SCALE) })));
  }
  if (!paths.length) return [];
  return Clipper.union(paths, FillRule.NonZero)
    .map((path) => path.map(({ x, y }): Point => [x / SCALE, y / SCALE]))
    .filter((ring) => ring.length >= 3 && Math.abs(ringArea(ring)) > MIN_AREA);
}
