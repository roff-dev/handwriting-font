import { ACCENT_MARKS } from '../project/sets';

// One geometry for the printable templates and for reading photos of them back. All sizes are in PDF
// points (1/72 inch), measured from the page's top-left corner, y down.

export type PaperSize = 'a4' | 'letter';
export const templateFileName = (size: PaperSize) => `handwriting-template-${size}.pdf`;
export const PAPER: Record<PaperSize, { width: number; height: number; label: string }> = {
  a4: { width: 595.28, height: 841.89, label: 'A4' },
  letter: { width: 612, height: 792, label: 'US Letter' },
};

export const MARKER_DICTIONARY = 'ARUCO_MIP_36h12';
/** A 6 × 6-bit ArUco marker plus its black border: 8 modules, about 16 mm across. */
export const MARKER_MODULES = 8;
export const MARKER_SIZE = 46;
const MARKER_INSET = 24;

export const COLS = 6;
export const ROWS = 8;
const GRID_LEFT = 28.8;
const GRID_TOP = 80;
const GRID_BOTTOM = 76;
/** Gap between neighbouring box outlines, and the strip at the top of each box that holds its label. */
const FRAME_GAP = 2;
const LABEL_STRIP = 11;
const WRITING_INSET = 4;

/** Font units shown in a box: from below the descender to above the cap height. */
export const EM_TOP = 860;
export const EM_BOTTOM = -260;
/** Where x = 0 in font units sits across the box, as a fraction of its width. */
const ORIGIN_X = 0.18;
export const GUIDES = [0, 480, 700] as const;

export type Cell = { ch: string; version: 0 | 1 | 2 };
export type Box = { x: number; y: number; w: number; h: number };

/** Page 3 asks for second and third versions of the 24 most used letters. */
const VARIANT_LETTERS = [...'etaoinshrdlcumwfgypbvkjx'];

export const PAGES: Cell[][] = [
  [...'abcdefghijklmnopqrstuvwxyz0123456789.,!?\'"-()&:;'].map((ch) => ({ ch, version: 0 })),
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ@/#$%*+=£€', ...ACCENT_MARKS, ...'<>[]_'].map((ch) => ({ ch, version: 0 })),
  [...VARIANT_LETTERS.map((ch): Cell => ({ ch, version: 1 })), ...VARIANT_LETTERS.map((ch): Cell => ({ ch, version: 2 }))],
];

/**
 * Marker ids say which page this is and what paper it was printed on, so a photo needs no other hint:
 * A4 page p uses 4(p − 1) … 4(p − 1) + 3, Letter adds 12. Corner order: top-left, top-right,
 * bottom-right, bottom-left.
 */
export const markerId = (size: PaperSize, page: number, corner: number) => (size === 'letter' ? 12 : 0) + 4 * page + corner;

export function identify(id: number): { size: PaperSize; page: number; corner: number } | null {
  if (id < 0 || id >= 24) return null;
  return { size: id >= 12 ? 'letter' : 'a4', page: Math.floor((id % 12) / 4), corner: id % 4 };
}

/** Top-left corner of each marker, in corner order. */
export function markerOrigins(size: PaperSize): [number, number][] {
  const { width, height } = PAPER[size], far = (n: number) => n - MARKER_INSET - MARKER_SIZE;
  return [
    [MARKER_INSET, MARKER_INSET],
    [far(width), MARKER_INSET],
    [far(width), far(height)],
    [MARKER_INSET, far(height)],
  ];
}

/** The four corners of a marker in page points, in the order the detector reports them (clockwise from top-left). */
export function markerCorners(size: PaperSize, corner: number): [number, number][] {
  const [x, y] = markerOrigins(size)[corner]!;
  return [[x, y], [x + MARKER_SIZE, y], [x + MARKER_SIZE, y + MARKER_SIZE], [x, y + MARKER_SIZE]];
}

/** The printed outline of box `i` (row by row). */
export function cellFrame(size: PaperSize, i: number): Box {
  const { width, height } = PAPER[size];
  const cw = (width - 2 * GRID_LEFT) / COLS, ch = (height - GRID_TOP - GRID_BOTTOM) / ROWS;
  const c = i % COLS, r = Math.floor(i / COLS);
  return { x: GRID_LEFT + c * cw + FRAME_GAP, y: GRID_TOP + r * ch + FRAME_GAP, w: cw - 2 * FRAME_GAP, h: ch - 2 * FRAME_GAP };
}

/**
 * The writing area of box `i`: inside the outline and below the label strip, so a photo of the page
 * only ever samples the writer's ink and the faint guides, never the printed label.
 */
export function cellBox(size: PaperSize, i: number): Box {
  const f = cellFrame(size, i);
  return { x: f.x + WRITING_INSET, y: f.y + LABEL_STRIP, w: f.w - 2 * WRITING_INSET, h: f.h - LABEL_STRIP - WRITING_INSET };
}

/** Where the box's label sits (its baseline), inside the strip above the writing area. */
export function labelOrigin(size: PaperSize, i: number): [number, number] {
  const f = cellFrame(size, i);
  return [f.x + WRITING_INSET, f.y + 8.5];
}

const unitsPerPoint = (b: Box) => (EM_TOP - EM_BOTTOM) / b.h;

export const unitToPage = (b: Box, [ux, uy]: [number, number]): [number, number] => [b.x + b.w * ORIGIN_X + ux / unitsPerPoint(b), b.y + (EM_TOP - uy) / unitsPerPoint(b)];
export const pageToUnit = (b: Box, [px, py]: [number, number]): [number, number] => [(px - b.x - b.w * ORIGIN_X) * unitsPerPoint(b), EM_TOP - (py - b.y) * unitsPerPoint(b)];
