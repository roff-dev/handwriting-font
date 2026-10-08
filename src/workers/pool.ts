import { wrap, type Remote } from 'comlink';
import type { Contour } from '../core/geometry';
import type { PenId, Stroke } from '../core/ink/strokes';
import type { GlyphWorkerApi } from './glyph.worker';

type Job = { run: (w: Remote<GlyphWorkerApi>) => Promise<Contour[]>; priority: number; resolve: (c: Contour[]) => void; reject: (e: unknown) => void };

export const poolSize = () => Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));

/**
 * Outlines glyphs on a few workers. Lower `priority` runs first, so after a weight change the glyphs on
 * screen are redone before the rest.
 */
export class GlyphPool {
  private idle: Remote<GlyphWorkerApi>[] = [];
  private workers: Worker[] = [];
  private queue: Job[] = [];

  constructor(size = poolSize()) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./glyph.worker.ts', import.meta.url), { type: 'module', name: `glyph-${i}` });
      this.workers.push(worker);
      this.idle.push(wrap<GlyphWorkerApi>(worker));
    }
  }

  outline(strokes: Stroke[], pen: PenId, weight: number, priority = 0): Promise<Contour[]> {
    return this.enqueue((w) => w.outline(strokes, pen, weight), priority);
  }

  /** A photo glyph's traced outline, grown or shrunk to the Weight setting. */
  inflate(contours: Contour[], weight: number, priority = 0): Promise<Contour[]> {
    return this.enqueue((w) => w.inflate(contours, weight), priority);
  }

  private enqueue(run: Job['run'], priority: number): Promise<Contour[]> {
    return new Promise((resolve, reject) => {
      const job = { run, priority, resolve, reject };
      const at = this.queue.findIndex((j) => j.priority > priority);
      if (at < 0) this.queue.push(job);
      else this.queue.splice(at, 0, job);
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop()!, job = this.queue.shift()!;
      job
        .run(worker)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.idle.push(worker);
          this.pump();
        });
    }
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    for (const job of this.queue) job.reject(new Error('Pool closed'));
    this.queue = [];
  }
}
