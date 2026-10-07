import type { Contour } from '../geometry';

export const UPM = 1000;
export const NOTDEF_ADVANCE = 500;
export const VERTICAL = { ascender: 800, descender: -200, lineGap: 200 } as const;

/** A glyph ready to write: positioned (lsb already applied) in font units with CFF winding. */
export type FontGlyph = { name: string; unicode?: number; advance: number; contours: Contour[] };

/** `alts[0]` is the glyph's first variant (`.alt1`), `alts[1]` its second. */
export type VariantSet = { base: string; alts: string[] };

export type PairLigature = { glyph: string; components: [string, string] };

/**
 * Class kerning. A glyph's `left` class describes it as the first glyph of a pair (its right side),
 * its `right` class as the second (its left side). Class 0 means “no kerning”.
 */
export type KerningClasses = {
  left: Map<string, number>;
  right: Map<string, number>;
  leftCount: number;
  rightCount: number;
  /** Row-major: `values[leftClass * rightCount + rightClass]`. */
  values: Int16Array;
  /** Glyphs whose pairs also go into the legacy `kern` table, for apps that only read that. */
  legacy: string[];
};

export type FontSpec = {
  family: string;
  designer?: string;
  date: Date;
  xHeight: number;
  capHeight: number;
  /** In output order, without `.notdef` (added by the builder). Must include `space`. */
  glyphs: FontGlyph[];
  variants: VariantSet[];
  pairs: PairLigature[];
  kerning?: KerningClasses;
};
