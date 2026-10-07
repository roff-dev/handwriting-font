import { expose } from 'comlink';
import { strokesToContours } from '../core/ink/glyph';
import { PENS, type PenId, type Stroke } from '../core/ink/strokes';

const api = {
  outline(strokes: Stroke[], pen: PenId, weight: number) {
    return strokesToContours(strokes, PENS[pen], weight);
  },
};

export type GlyphWorkerApi = typeof api;
expose(api);
