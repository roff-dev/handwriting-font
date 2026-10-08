import { expose } from 'comlink';
import type { Contour } from '../core/geometry';
import { strokesToContours } from '../core/ink/glyph';
import { inflateContours } from '../core/ink/inflate';
import { PENS, type PenId, type Stroke } from '../core/ink/strokes';

const api = {
  outline(strokes: Stroke[], pen: PenId, weight: number) {
    return strokesToContours(strokes, PENS[pen], weight);
  },
  inflate(contours: Contour[], weight: number) {
    return inflateContours(contours, weight);
  },
};

export type GlyphWorkerApi = typeof api;
expose(api);
