import type { Contour } from '../geometry';
import { ALL_FEATURES, shape, type Features, type LayoutFont } from './layout';

export type TextImage = {
  /** Font units: one em is 1000. */
  width: number;
  height: number;
  /** One path per inked glyph, in image coordinates (y down), as SVG path data. */
  glyphs: { d: string; x: number; y: number }[];
};

const LINE_HEIGHT = 1250;
const MARGIN = 250;
const TOP = 950;
const BOTTOM = 300;

const n = (v: number) => Math.round(v * 10) / 10;

/** A glyph's outline as path data with y flipped, so it can be placed in y-down image space. */
function flippedPath(contours: Contour[]): string {
  let d = '';
  for (const c of contours) {
    if (!c.length) continue;
    d += `M${n(c[0]![0][0])} ${n(-c[0]![0][1])}`;
    for (const [, c1, c2, p] of c) d += `C${n(c1[0])} ${n(-c1[1])} ${n(c2[0])} ${n(-c2[1])} ${n(p[0])} ${n(-p[1])}`;
    d += 'Z';
  }
  return d;
}

/**
 * Lay out text in the user's font for an image: line breaks where the text has them, 1.25 em lines,
 * a 0.25 em margin. Characters the font doesn't have are left out rather than drawn as boxes.
 */
export function layoutText(text: string, font: LayoutFont, outlines: Map<string, Contour[]>, features: Features = ALL_FEATURES): TextImage {
  const known = (ch: string) => ch === ' ' || font.cmap.has(ch.codePointAt(0)!);
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => [...l].filter(known).join(''));
  const paths = new Map<string, string>();
  const glyphs: TextImage['glyphs'] = [];
  let width = 0;
  lines.forEach((line, i) => {
    const baseline = MARGIN + TOP + i * LINE_HEIGHT;
    const run = shape(line, font, features);
    for (const g of run) {
      const contours = outlines.get(g.name);
      if (!contours?.length) continue;
      if (!paths.has(g.name)) paths.set(g.name, flippedPath(contours));
      glyphs.push({ d: paths.get(g.name)!, x: MARGIN + g.x, y: baseline });
    }
    const last = run[run.length - 1];
    if (last) width = Math.max(width, last.x + last.advance);
  });
  return { width: Math.ceil(width + 2 * MARGIN), height: MARGIN * 2 + TOP + BOTTOM + (lines.length - 1) * LINE_HEIGHT, glyphs };
}

export function toSvg(image: TextImage, colour: string): string {
  const body = image.glyphs.map((g) => `<path transform="translate(${n(g.x)} ${n(g.y)})" d="${g.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}" width="${image.width / 10}" height="${image.height / 10}" fill="${colour}">${body}</svg>`;
}

/** PNG size: 512 px tall for a single line, so the longest side never passes 4,096 px (iOS's safe canvas size). */
export function pngScale(image: TextImage): number {
  const oneLine = 512 / (MARGIN * 2 + TOP + BOTTOM);
  return Math.min(oneLine, 4096 / Math.max(image.width, image.height));
}

export const imageFileName = (text: string) =>
  (text.trim().slice(0, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'handwriting');
