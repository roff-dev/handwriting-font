import { expose, transfer } from 'comlink';
import { assemble, type ProjectOutlines } from '../core/assemble';
import { buildFont, type BuiltFont } from '../core/font/build';
import { fontFaceCss } from '../core/font/css';
import { layoutText } from '../core/font/image';
import { layoutFont, type Features } from '../core/font/layout';
import { makeMobileconfig } from '../core/font/mobileconfig';
import { toTrueType } from '../core/font/truetype';
import type { FontSpec } from '../core/font/types';
import { toWoff } from '../core/font/woff';
import { toWoff2 } from '../core/font/woff2';

let last: { spec: FontSpec; built: BuiltFont } | undefined;

const latest = () => {
  if (!last) throw new Error('Build a font first');
  return last;
};

const api = {
  /** Tidy, space, kern and write the OTF. The font stays here for the export calls that follow. */
  build(project: ProjectOutlines) {
    const { spec, offLine, kerningPairs } = assemble(project);
    const built = buildFont(spec);
    last = { spec, built };
    const otf = built.otf.slice(0);
    const chars = spec.glyphs.flatMap((g) => (g.unicode !== undefined ? [String.fromCodePoint(g.unicode)] : []));
    return transfer({ otf, chars, offLine: [...offLine], kerningPairs, glyphCount: built.glyphOrder.length }, [otf]);
  },

  otf() {
    const otf = latest().built.otf.slice(0);
    return transfer(otf, [otf]);
  },

  ttf() {
    const { built } = latest();
    const ttf = toTrueType(built.otf, built.outlines);
    return transfer(ttf, [ttf]);
  },

  /** WOFF2 with a Brotli encoder compiled to WebAssembly, fetched the first time someone asks for it. */
  async woff2() {
    const { built } = latest();
    const brotli = await (await import('brotli-wasm')).default;
    const woff2 = toWoff2(toTrueType(built.otf, built.outlines), (data) => brotli.compress(data, { quality: 11 }));
    return transfer(woff2, [woff2.buffer]);
  },

  woff() {
    const { built } = latest();
    const woff = toWoff(toTrueType(built.otf, built.outlines));
    return transfer(woff, [woff.buffer]);
  },

  mobileconfig() {
    const { spec, built } = latest();
    return makeMobileconfig(toTrueType(built.otf, built.outlines), spec.family);
  },

  css() {
    return fontFaceCss(latest().spec.family);
  },

  /** Typed text laid out in the font, as glyph paths ready for SVG or a canvas. */
  textImage(text: string, features: Features) {
    const { spec } = latest();
    return layoutText(text, layoutFont(spec), new Map(spec.glyphs.map((g) => [g.name, g.contours])), features);
  },
};

export type FontWorkerApi = typeof api;
expose(api);
