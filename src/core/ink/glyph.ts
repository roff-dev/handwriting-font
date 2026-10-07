import type { Contour } from '../geometry';
import { fitRing } from './fit';
import { orient } from './orient';
import { unionRings } from './outline';
import { strokeOutline, type Pen, type Stroke } from './strokes';

/** Everything the user drew for one glyph → clean, fitted, correctly wound contours in font units. */
export function strokesToContours(strokes: Stroke[], pen: Pen, weight: number): Contour[] {
  const rings = unionRings(strokes.map((s) => strokeOutline(s, pen, weight)));
  return orient(rings.map((r) => fitRing(r)).filter((c) => c.length > 0));
}
