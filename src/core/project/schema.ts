import type { Contour } from '../geometry';
import type { PenId, Stroke } from '../ink/strokes';
import type { SetId } from './sets';

export type DrawnVariant = { source: 'pen'; strokes: Stroke[]; updatedAt: number };
export type PhotoVariant = { source: 'photo'; contours: Contour[]; updatedAt: number };
export type Variant = DrawnVariant | PhotoVariant;

export type Settings = { pen: PenId; weight: number; tidy: number; spacing: number; sets: SetId[] };

export type Project = {
  format: 'hwfont';
  version: 1;
  name: string;
  designer: string;
  settings: Settings;
  /** char → versions; index 0 is the default, 1 and 2 the alternates. */
  glyphs: Record<string, Variant[]>;
  /** Two-character joined pairs, e.g. "th". */
  pairs: Record<string, DrawnVariant>;
};

export const DEFAULT_SETTINGS: Settings = { pen: 'fineliner', weight: 1, tidy: 0.6, spacing: 1, sets: ['standard'] };

export const emptyProject = (): Project => ({
  format: 'hwfont',
  version: 1,
  name: 'My Hand',
  designer: '',
  settings: { ...DEFAULT_SETTINGS, sets: [...DEFAULT_SETTINGS.sets] },
  glyphs: {},
  pairs: {},
});
