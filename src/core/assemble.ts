import { mapContours, type Contour } from './geometry';
import { altName, glyphName, pairName } from './font/glyphNames';
import type { FontGlyph, FontSpec, KerningClasses, VariantSet } from './font/types';
import { ACCENTED, compose, decompose, MARKS } from './glyphs/compose';
import { DERIVED_FROM, derive } from './glyphs/derive';
import { isCapitalLike } from './metrics/categories';
import { kernValue, referenceGaps, type KernGlyph } from './metrics/kerning';
import { gridProfile } from './metrics/profiles';
import { sidebearings, spaceAdvance, type SpacingParams } from './metrics/spacing';
import { capHeightOf, references, tidyGlyph, tidyPair, xHeightOf } from './metrics/tidy';

export type ProjectOutlines = {
  family: string;
  designer?: string;
  date: Date;
  /** Pen size × weight, in font units. */
  penSize: number;
  tidy: number;
  spacing: number;
  /** char → its versions' outlines: index 0 is the default, then alt1, alt2. Marks use combining chars. */
  glyphs: Map<string, Contour[][]>;
  /** Two-character joined pairs → outline. */
  pairs: Map<string, Contour[]>;
};

export type Assembled = {
  spec: FontSpec;
  /** Characters whose drawing sits too far off the baseline to snap. */
  offLine: Set<string>;
  kerningPairs: number;
};

type Spaced = FontGlyph & { text: string; lsb: number; rsb: number; meanDepth: number; yMin: number; yMax: number };

const isMark = (ch: string) => ch in MARKS;

/**
 * Everything between the user's outlines and the font file: tidy heights, derive and compose the glyphs
 * nobody has to draw, space every glyph optically, then kern every pair of kerning classes.
 */
export function assemble(project: ProjectOutlines): Assembled {
  const drawn = [...project.glyphs].filter(([ch, versions]) => !isMark(ch) && versions[0]?.length);
  const refs = references(new Map(drawn.map(([ch, v]) => [ch, v[0]!])));
  const xHeight = xHeightOf(refs), capHeight = capHeightOf(refs);
  const params: SpacingParams = { xHeight, capHeight, penSize: project.penSize, spacing: project.spacing };
  const offLine = new Set<string>();
  const scales = new Map<string, number>();

  const space = (name: string, text: string, contours: Contour[], capitalZone: boolean, unicode?: number): Spaced => {
    const s = sidebearings(contours, capitalZone, params);
    const dx = s.lsb - s.bounds.x0;
    return {
      name, text, unicode,
      contours: mapContours(contours, ([x, y]) => [x + dx, y]),
      advance: Math.round(s.bounds.x1 - s.bounds.x0 + s.lsb + s.rsb),
      lsb: s.lsb, rsb: s.rsb, meanDepth: (s.depth.left + s.depth.right) / 2, yMin: s.bounds.y0, yMax: s.bounds.y1,
    };
  };

  const defaults = new Map<string, Spaced>(), alternates: Spaced[] = [], variants: VariantSet[] = [];
  const tidied = new Map<string, Contour[]>();
  for (const [ch, versions] of drawn) {
    const out = versions.filter((v) => v.length).map((v) => tidyGlyph(ch, v, refs, project.tidy));
    if (out[0]!.offLine) offLine.add(ch);
    scales.set(ch, out[0]!.scale);
    tidied.set(ch, out[0]!.contours);
    defaults.set(ch, space(glyphName(ch), ch, out[0]!.contours, isCapitalLike(ch), ch.codePointAt(0)));
    const alts = out.slice(1, 3).map((t, k) => {
      const g = space(altName(ch, k + 1), ch, t.contours, isCapitalLike(ch));
      alternates.push(g);
      return g.name;
    });
    if (alts.length) variants.push({ base: glyphName(ch), alts });
  }

  const derived = new Map<string, Spaced>();
  for (const [ch, from] of Object.entries(DERIVED_FROM)) {
    const source = tidied.get(from);
    if (!source) continue;
    const contours = derive(ch, source, { xHeight, periodAdvance: defaults.get('.')?.advance ?? 0 });
    if (contours.length) derived.set(ch, space(glyphName(ch), ch, contours, false, ch.codePointAt(0)));
  }

  const composed: Spaced[] = [];
  for (const ch of ACCENTED) {
    const { base, mark } = decompose(ch);
    const b = defaults.get(base) ?? derived.get(base), m = project.glyphs.get(mark)?.[0];
    if (!b || !m?.length) continue;
    const contours = compose(b.contours, m, /^[A-Z]$/.test(base), mark === '̧', xHeight);
    composed.push({ ...b, name: glyphName(ch), text: ch, unicode: ch.codePointAt(0), contours });
  }

  const pairs: Spaced[] = [];
  for (const [pair, contours] of project.pairs) {
    const [a, b] = [...pair] as [string, string];
    if (!defaults.has(a) || !defaults.has(b) || !contours.length) continue;
    const t = tidyPair(contours, [scales.get(a) ?? 1, scales.get(b) ?? 1], refs);
    if (t.offLine) offLine.add(pair);
    pairs.push(space(pairName(pair), pair, t.contours, /[A-Z]/.test(pair)));
  }

  const lowercase = [...defaults].filter(([ch]) => /^[a-z]$/.test(ch)).map(([, g]) => g.advance);
  const spaceGlyph: FontGlyph = { name: 'space', unicode: 32, advance: spaceAdvance(lowercase), contours: [] };

  // Kerning classes: one per drawn or derived glyph and per pair. Alternates and accented letters share
  // their base's class, so they kern the same way.
  const classMembers = new Map<Spaced, string[]>();
  for (const g of [...defaults.values(), ...derived.values(), ...pairs]) classMembers.set(g, [g.name]);
  const owner = (text: string) => defaults.get(text) ?? derived.get(text);
  for (const g of alternates) classMembers.get(defaults.get(g.text)!)!.push(g.name);
  for (const g of composed) {
    const base = owner(decompose(g.text).base);
    if (base) classMembers.get(base)!.push(g.name);
  }
  for (const [ch, from] of Object.entries(DERIVED_FROM)) {
    const d = derived.get(ch), src = defaults.get(from);
    if (d && src && ch !== 'ı') {
      classMembers.delete(d);
      classMembers.get(src)!.push(d.name);
    }
  }
  const classes = [...classMembers.keys()];
  const kernGlyphs = classes.map((g): KernGlyph & { meanDepth: number } => ({
    text: g.text, advance: g.advance, lsb: g.lsb, rsb: g.rsb, meanDepth: g.meanDepth,
    profile: gridProfile(g.contours, g.yMin, g.yMax),
  }));
  const refGaps = referenceGaps(new Map(classes.flatMap((g, i) => (g.text.length === 1 ? [[g.text, kernGlyphs[i]!] as const] : []))), xHeight);
  const n = classes.length + 1, values = new Int16Array(n * n);
  let kerningPairs = 0;
  for (let a = 0; a < classes.length; a++) for (let b = 0; b < classes.length; b++) {
    const k = kernValue(kernGlyphs[a]!, kernGlyphs[b]!, refGaps, xHeight);
    if (k) {
      values[(a + 1) * n + b + 1] = k;
      kerningPairs++;
    }
  }
  const classOf = new Map<string, number>();
  classes.forEach((g, i) => classMembers.get(g)!.forEach((name) => classOf.set(name, i + 1)));
  const legacy = [...defaults.values(), ...derived.values(), ...composed].map((g) => g.name);
  const kerning: KerningClasses = { left: classOf, right: classOf, leftCount: n, rightCount: n, values, legacy };

  const byCode = (a: Spaced, b: Spaced) => a.text.codePointAt(0)! - b.text.codePointAt(0)!;
  const strip = ({ name, unicode, advance, contours }: Spaced): FontGlyph => ({ name, unicode, advance, contours });
  const glyphs: FontGlyph[] = [
    spaceGlyph,
    ...[...defaults.values(), ...derived.values(), ...composed].sort(byCode).map(strip),
    ...alternates.map(strip),
    ...pairs.map(strip),
  ];

  return {
    spec: {
      family: project.family,
      designer: project.designer,
      date: project.date,
      xHeight,
      capHeight,
      glyphs,
      variants,
      pairs: pairs.map((p) => ({ glyph: p.name, components: [glyphName(p.text[0]!), glyphName(p.text[1]!)] })),
      kerning,
    },
    offLine,
    kerningPairs,
  };
}
