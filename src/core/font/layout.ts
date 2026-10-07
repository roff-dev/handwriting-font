import { NOTDEF_ADVANCE, type FontSpec, type KerningClasses } from './types';

export type LayoutFont = {
  cmap: Map<number, string>;
  advance: Map<string, number>;
  /** `first + '\u0000' + second` → pair glyph. */
  pairs: Map<string, string>;
  alt1: Map<string, string>;
  alt2: Map<string, string>;
  alt1Glyphs: Set<string>;
  neutral: Set<string>;
  kerning?: KerningClasses;
};

export type Features = { liga: boolean; calt: boolean; kern: boolean };
export const ALL_FEATURES: Features = { liga: true, calt: true, kern: true };

export type PlacedGlyph = { name: string; x: number; advance: number; cluster: number };

export const NOTDEF = '.notdef';
const pairKey = (a: string, b: string) => `${a}\u0000${b}`;

export function layoutFont(spec: FontSpec): LayoutFont {
  const alternates = new Set(spec.variants.flatMap((v) => v.alts));
  return {
    cmap: new Map(spec.glyphs.filter((g) => g.unicode !== undefined).map((g) => [g.unicode!, g.name])),
    advance: new Map([[NOTDEF, NOTDEF_ADVANCE], ...spec.glyphs.map((g): [string, number] => [g.name, g.advance])]),
    pairs: new Map(spec.pairs.map((p) => [pairKey(...p.components), p.glyph])),
    alt1: new Map(spec.variants.filter((v) => v.alts[0]).map((v) => [v.base, v.alts[0]!])),
    alt2: new Map(spec.variants.filter((v) => v.alts[1]).map((v) => [v.base, v.alts[1]!])),
    alt1Glyphs: new Set(spec.variants.flatMap((v) => (v.alts[0] ? [v.alts[0]] : []))),
    neutral: new Set(spec.glyphs.filter((g) => !alternates.has(g.name)).map((g) => g.name)),
    kerning: spec.kerning,
  };
}

/**
 * Shape one line exactly as the font's own GSUB and GPOS would: pairs left to right, then the variant
 * cycle reading the glyph before, then class kerning. Characters the font lacks become `.notdef`,
 * which, like in a real shaper, resets the cycle.
 */
export function shape(text: string, font: LayoutFont, features: Features = ALL_FEATURES): PlacedGlyph[] {
  let run: { name: string; cluster: number }[] = [];
  let cluster = 0;
  for (const ch of text) {
    run.push({ name: font.cmap.get(ch.codePointAt(0)!) ?? NOTDEF, cluster });
    cluster += ch.length;
  }

  if (features.liga && font.pairs.size) {
    const joined: typeof run = [];
    for (let i = 0; i < run.length; i++) {
      const next = run[i + 1];
      const pair = next && font.pairs.get(pairKey(run[i]!.name, next.name));
      if (pair) {
        joined.push({ name: pair, cluster: run[i]!.cluster });
        i++;
      } else joined.push(run[i]!);
    }
    run = joined;
  }

  if (features.calt) {
    for (let i = 1; i < run.length; i++) {
      const prev = run[i - 1]!.name, cur = run[i]!;
      if (font.neutral.has(prev) && font.alt1.has(cur.name)) cur.name = font.alt1.get(cur.name)!;
      else if (font.alt1Glyphs.has(prev) && font.alt2.has(cur.name)) cur.name = font.alt2.get(cur.name)!;
    }
  }

  const k = features.kern ? font.kerning : undefined;
  let x = 0;
  return run.map((g, i) => {
    let advance = font.advance.get(g.name) ?? 0;
    const next = run[i + 1];
    if (k && next) advance += k.values[(k.left.get(g.name) ?? 0) * k.rightCount + (k.right.get(next.name) ?? 0)]!;
    const placed = { name: g.name, x, advance, cluster: g.cluster };
    x += advance;
    return placed;
  });
}
