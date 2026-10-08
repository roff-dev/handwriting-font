import { Clipper, EndType, JoinType, type Paths64 } from '@countertype/clipper2-ts';
import { flatten, ringArea, type Contour, type Point } from '../geometry';
import { fitRing, PEN_FIT } from './fit';
import { orient } from './orient';

const SCALE = 64;
/** Font units of growth per step of the Weight slider, for glyphs that came from a photo. */
export const PHOTO_WEIGHT_UNITS = 30;

/**
 * Photo glyphs have no strokes to redraw at a new pen size, so Weight grows or shrinks their outline
 * instead: (weight − 1) × 30 units, with round joins so corners stay soft like ink.
 */
export function inflateContours(contours: Contour[], weight: number): Contour[] {
  const delta = (weight - 1) * PHOTO_WEIGHT_UNITS;
  if (Math.abs(delta) < 0.5) return contours;
  const paths: Paths64 = contours.map((c) => flatten(c, 12).map(([x, y]) => ({ x: Math.round(x * SCALE), y: Math.round(y * SCALE) })));
  const grown = Clipper.inflatePaths(paths, delta * SCALE, JoinType.Round, EndType.Polygon);
  const rings = grown.map((p) => p.map(({ x, y }): Point => [x / SCALE, y / SCALE])).filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > 4);
  return orient(rings.map((r) => fitRing(r, PEN_FIT)).filter((c) => c.length));
}
