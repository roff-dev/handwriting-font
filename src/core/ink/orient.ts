import { contourArea, flatten, pointInRing, type Contour, type Cubic } from '../geometry';

export const reverseContour = (c: Contour): Contour => c.slice().reverse().map(([p0, c1, c2, p3]): Cubic => [p3, c2, c1, p0]);

/**
 * PostScript/CFF winding: outer contours anticlockwise, holes clockwise, decided by nesting depth.
 * The TrueType writer reverses everything, because TrueType wants the opposite.
 */
export function orient(contours: Contour[]): Contour[] {
  const rings = contours.map((c) => flatten(c, 4));
  return contours.map((c, i) => {
    const probe = rings[i]![0]!;
    const depth = rings.reduce((d, ring, j) => (j !== i && pointInRing(probe, ring) ? d + 1 : d), 0);
    const wantAnticlockwise = depth % 2 === 0;
    return wantAnticlockwise === contourArea(c) > 0 ? c : reverseContour(c);
  });
}
