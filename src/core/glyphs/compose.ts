import { bounds, flatten, mapContours, type Contour } from '../geometry';
import { fitRing } from '../ink/fit';
import { orient } from '../ink/orient';
import { unionRings } from '../ink/outline';
import { mainInkBounds } from '../metrics/categories';
import type { Mark } from './marks';

export { MARKS, type Mark } from './marks';


export const ACCENTED = [...'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸàáâãäåçèéêëìíîïñòóôõöùúûüýÿ'];

/** `é` → `e` + acute. Accented i's sit on the dotless ı. */
export function decompose(ch: string): { base: string; mark: Mark } {
  const [base, mark] = [...ch.normalize('NFD')] as [string, Mark];
  return { base: base === 'i' ? 'ı' : base, mark };
}

/**
 * Place a drawn mark on a spaced base glyph: centred on the base's main ink, a small gap above it
 * (smaller, with a smaller mark, on capitals), or hanging just below for the cedilla.
 */
export function compose(base: Contour[], mark: Contour[], capital: boolean, isCedilla: boolean, xHeight: number): Contour[] {
  const bb = mainInkBounds(base), mb0 = bounds(mark);
  const scale = capital && !isCedilla ? 0.85 : 1;
  const mcx = (mb0.x0 + mb0.x1) / 2, mcy = (mb0.y0 + mb0.y1) / 2;
  const scaled = mapContours(mark, ([x, y]) => [mcx + (x - mcx) * scale, mcy + (y - mcy) * scale]);
  const mb = bounds(scaled);
  const dx = (bb.x0 + bb.x1) / 2 - (mb.x0 + mb.x1) / 2;
  const dy = isCedilla ? bb.y0 - 0.02 * xHeight - mb.y1 : bb.y1 + (capital ? 0.06 : 0.08) * xHeight - mb.y0;
  const placed = mapContours(scaled, ([x, y]) => [x + dx, y + dy]);
  const all = [...base, ...placed];
  const pb = bounds(placed), fb = bounds(base);
  const overlaps = pb.x0 < fb.x1 && pb.x1 > fb.x0 && pb.y0 < fb.y1 && pb.y1 > fb.y0;
  if (!overlaps) return all;
  // A cedilla or a low-slung mark can touch the letter; merge so the glyph has no overlapping contours.
  return orient(unionRings(all.map((c) => flatten(c, 12))).map((r) => fitRing(r)));
}
