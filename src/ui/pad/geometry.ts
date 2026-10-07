/** The writing box in font units (y up). Letters use a square, joined pairs a wider one. */
export type PadBox = { x0: number; x1: number; y0: number; y1: number };

export const LETTER_BOX: PadBox = { x0: 0, x1: 1250, y0: -300, y1: 950 };
export const PAIR_BOX: PadBox = { x0: 0, x1: 2000, y0: -300, y1: 950 };

export const GUIDE_LINES = [
  { y: 0, kind: 'baseline' },
  { y: 480, kind: 'x-height' },
  { y: 700, kind: 'cap-height' },
  { y: -240, kind: 'descender' },
] as const;

export const aspect = (box: PadBox) => (box.x1 - box.x0) / (box.y1 - box.y0);

/** CSS pixel offset inside the pad → font units. */
export function toFontUnits(box: PadBox, width: number, x: number, y: number): [number, number] {
  const k = (box.x1 - box.x0) / width;
  return [box.x0 + x * k, box.y1 - y * k];
}
