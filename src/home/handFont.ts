import { wrap, type Remote } from 'comlink';
import type { Contour } from '../core/geometry';
import { PENS, type Stroke } from '../core/ink/strokes';
import type { FontWorkerApi } from '../workers/font.worker';
import { GlyphPool } from '../workers/pool';

/**
 * The home page's tiny font: every letter the visitor has drawn so far, rebuilt after each one. The
 * workers start on the first committed letter, so visitors who only read pay nothing for them.
 */
export class HandFont {
  private pool?: GlyphPool;
  private worker?: Remote<FontWorkerApi>;
  private outlines = new Map<string, Contour[]>();
  private face?: FontFace;
  private builds = 0;

  async add(letters: [string, Stroke[]][]): Promise<string> {
    this.pool ??= new GlyphPool(1);
    this.worker ??= wrap<FontWorkerApi>(new Worker(new URL('../workers/font.worker.ts', import.meta.url), { type: 'module', name: 'font' }));
    const outlined = await Promise.all(letters.map(async ([ch, strokes]) => [ch, await this.pool!.outline(strokes, 'fineliner', 1)] as const));
    for (const [ch, contours] of outlined) this.outlines.set(ch, contours);
    const { otf } = await this.worker.build({
      family: 'Your Hand',
      date: new Date(),
      penSize: PENS.fineliner.size,
      tidy: 0.6,
      spacing: 1,
      glyphs: new Map([...this.outlines].map(([ch, c]) => [ch, [c]])),
      pairs: new Map(),
    });
    const family = `Your Hand ${++this.builds}`;
    const face = new FontFace(family, otf);
    await face.load();
    document.fonts.add(face);
    if (this.face) document.fonts.delete(this.face);
    this.face = face;
    return family;
  }

  get drawn() {
    return new Set(this.outlines.keys());
  }
}
