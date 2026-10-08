import opentype from 'opentype.js';
import { line, type Contour, type Point } from '../geometry';
import { orient } from '../ink/orient';
import { withUnicodePlatform } from './cmap';
import { makeGpos, makeLegacyKern, type ClassKerning } from './gpos';
import { makeGsub } from './gsub';
import { cleanFamily, makeNameTable, STYLE } from './names';
import { readTables, writeSfnt } from './sfnt';
import { NOTDEF_ADVANCE, UPM, VERTICAL, type FontGlyph, type FontSpec } from './types';

export type BuiltFont = {
  otf: ArrayBuffer;
  /** Glyph names in id order, starting with `.notdef`. */
  glyphOrder: string[];
  ids: Map<string, number>;
  /** Unrounded outlines in id order, for the TrueType writer. */
  outlines: Contour[][];
  advances: number[];
};

/** Seconds from 1904-01-01 (the sfnt epoch) to 1970-01-01. */
const MAC_EPOCH_OFFSET = 2_082_844_800;

const box = (pts: Point[]): Contour => pts.map((p, i) => line(p, pts[(i + 1) % pts.length]!));
const NOTDEF: FontGlyph = {
  name: '.notdef',
  advance: NOTDEF_ADVANCE,
  contours: orient([
    box([[60, 0], [440, 0], [440, 700], [60, 700]]),
    box([[110, 50], [110, 650], [390, 650], [390, 50]]),
  ]),
};

function toPath(contours: Contour[]) {
  const path = new opentype.Path();
  for (const c of contours) {
    if (!c.length) continue;
    path.moveTo(Math.round(c[0]![0][0]), Math.round(c[0]![0][1]));
    for (const [, c1, c2, p] of c) path.curveTo(Math.round(c1[0]), Math.round(c1[1]), Math.round(c2[0]), Math.round(c2[1]), Math.round(p[0]), Math.round(p[1]));
    path.close();
  }
  return path;
}

/**
 * Build the CFF-flavoured OpenType font. opentype.js assembles the outlines and the basic tables; the
 * name table, both cmap platforms, GSUB, GPOS and the legacy kern table are written here and swapped in.
 */
export function buildFont(spec: FontSpec): BuiltFont {
  const glyphs = [NOTDEF, ...spec.glyphs];
  const ids = new Map(glyphs.map((g, i) => [g.name, i]));
  const id = (name: string) => {
    const v = ids.get(name);
    if (v === undefined) throw new Error(`Unknown glyph ${name}`);
    return v;
  };

  // Control points bound the curves, and they are what the font's own bounding boxes are measured from.
  let yMax = 0, yMin = 0;
  for (const g of glyphs) for (const c of g.contours) for (const seg of c) for (const [, y] of seg) {
    yMax = Math.max(yMax, Math.round(y));
    yMin = Math.min(yMin, Math.round(y));
  }
  const font = new opentype.Font({
    familyName: cleanFamily(spec.family),
    styleName: STYLE,
    unitsPerEm: UPM,
    ascender: VERTICAL.ascender,
    descender: VERTICAL.descender,
    weightClass: 400,
    glyphs: glyphs.map((g) => new opentype.Glyph({ name: g.name, unicode: g.unicode, advanceWidth: g.advance, path: toPath(g.contours) })),
    tables: {
      os2: {
        version: 4,
        usWeightClass: 400,
        usWidthClass: 5,
        fsType: 0,
        fsSelection: 0x0040 | 0x0080, // REGULAR | USE_TYPO_METRICS
        achVendID: 'NONE',
        sTypoAscender: VERTICAL.ascender,
        sTypoDescender: VERTICAL.descender,
        sTypoLineGap: VERTICAL.lineGap,
        // GDI clips anything outside the Windows metrics, so they cover every glyph.
        usWinAscent: Math.max(VERTICAL.ascender, yMax),
        usWinDescent: Math.max(-VERTICAL.descender, -yMin),
        sxHeight: Math.round(spec.xHeight),
        sCapHeight: Math.round(spec.capHeight),
      },
    },
  });

  const tables = readTables(font.toArrayBuffer());
  tables.delete('ltag');
  tables.set('name', makeNameTable({ family: spec.family, designer: spec.designer, date: spec.date }));
  tables.set('cmap', withUnicodePlatform(tables.get('cmap')!));
  const hhea = tables.get('hhea')!.slice();
  new DataView(hhea.buffer).setInt16(8, VERTICAL.lineGap);
  tables.set('hhea', hhea);
  // opentype.js stamps `modified` with the current time; use the project's date so builds are reproducible.
  const head = tables.get('head')!.slice(), hv = new DataView(head.buffer);
  const since1904 = BigInt(Math.floor(spec.date.getTime() / 1000) + MAC_EPOCH_OFFSET);
  hv.setBigUint64(20, since1904);
  hv.setBigUint64(28, since1904);
  tables.set('head', head);

  const alternates = new Set(spec.variants.flatMap((v) => v.alts));
  const gsub = makeGsub({
    variants: spec.variants.map((v) => ({ base: id(v.base), alts: v.alts.map(id) })),
    pairs: spec.pairs.map((p) => ({ glyph: id(p.glyph), first: id(p.components[0]), second: id(p.components[1]) })),
    neutral: glyphs.filter((g) => g.name !== '.notdef' && !alternates.has(g.name)).map((g) => id(g.name)),
  });
  if (gsub) tables.set('GSUB', gsub);

  const k = spec.kerning;
  // A font with nothing to kern (a few letters drawn so far) gets no kerning tables: an empty legacy
  // kern subtable makes Firefox's sanitiser warn and discard it.
  if (k && k.values.some((v) => v !== 0)) {
    const byId = (m: Map<string, number>) => new Map([...m].filter(([name]) => ids.has(name)).map(([name, c]) => [id(name), c]));
    const classes: ClassKerning = { left: byId(k.left), right: byId(k.right), leftCount: k.leftCount, rightCount: k.rightCount, values: k.values };
    tables.set('GPOS', makeGpos(classes));
    const legacy: [number, number, number][] = [];
    for (const l of k.legacy) for (const r of k.legacy) {
      const v = k.values[(k.left.get(l) ?? 0) * k.rightCount + (k.right.get(r) ?? 0)]!;
      if (v && ids.has(l) && ids.has(r)) legacy.push([id(l), id(r), v]);
    }
    if (legacy.length) tables.set('kern', makeLegacyKern(legacy));
  }

  return {
    otf: writeSfnt(tables, 'cff'),
    glyphOrder: glyphs.map((g) => g.name),
    ids,
    outlines: glyphs.map((g) => g.contours),
    advances: glyphs.map((g) => g.advance),
  };
}
