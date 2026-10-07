import { bounds, mapContours, type Contour } from '../geometry';

/** Glyphs made from others the user drew, so they don't have to draw them: char → source char. */
export const DERIVED_FROM: Record<string, string> = {
  '’': "'", '‘': "'", '”': '"', '“': '"', '–': '-', '—': '-', '…': '.', ı: 'i',
};

function rotate180(contours: Contour[]): Contour[] {
  const b = bounds(contours), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return mapContours(contours, ([x, y]) => [2 * cx - x, 2 * cy - y]);
}

function stretchX(contours: Contour[], factor: number): Contour[] {
  const b = bounds(contours), cx = (b.x0 + b.x1) / 2;
  return mapContours(contours, ([x, y]) => [cx + (x - cx) * factor, y]);
}

/**
 * Derive one glyph from its source's tidied outline. The ellipsis needs the full stop's spaced advance,
 * so its three dots sit exactly as three typed full stops would.
 */
export function derive(ch: string, source: Contour[], { xHeight, periodAdvance }: { xHeight: number; periodAdvance: number }): Contour[] {
  switch (ch) {
    case '’':
    case '”':
      return source;
    case '‘':
    case '“':
      return rotate180(source);
    case '–':
      return stretchX(source, 1.6);
    case '—':
      return stretchX(source, 3.2);
    case '…':
      return [0, 1, 2].flatMap((k) => mapContours(source, ([x, y]) => [x + k * periodAdvance, y]));
    case 'ı':
      return source.filter((c) => bounds([c]).y0 < 0.9 * xHeight);
    default:
      throw new Error(`No derivation for ${ch}`);
  }
}
