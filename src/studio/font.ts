import { wrap, type Remote } from 'comlink';
import { create } from 'zustand';
import type { ProjectOutlines } from '../core/assemble';
import type { Contour } from '../core/geometry';
import { PENS } from '../core/ink/strokes';
import type { Project } from '../core/project/schema';
import type { FontWorkerApi } from '../workers/font.worker';
import { slotKey } from './slots';
import { useStudio } from './store';

/** How long after the last change to rebuild. Short, because a rebuild at 4× CPU takes most of a second. */
export const REBUILD_DELAY = 300;

type LiveFont = {
  /** CSS family of the newest loaded build; each build gets its own so the browser never shows a stale one. */
  family: string | null;
  chars: Set<string>;
  building: boolean;
  failed: boolean;
  builtAt: number;
  kerningPairs: number;
};

export const useLiveFont = create<LiveFont>(() => ({ family: null, chars: new Set(), building: false, failed: false, builtAt: 0, kerningPairs: 0 }));

let worker: Remote<FontWorkerApi> | undefined;
export const fontWorker = () =>
  (worker ??= wrap<FontWorkerApi>(new Worker(new URL('../workers/font.worker.ts', import.meta.url), { type: 'module', name: 'font' })));

/** The outlines the font needs, or null while a drawn glyph is still waiting for its outline. */
export function projectOutlines(project: Project, outlines: Record<string, Contour[]>): ProjectOutlines | null {
  const glyphs = new Map<string, Contour[][]>();
  for (const [ch, versions] of Object.entries(project.glyphs)) {
    const list: Contour[][] = [];
    for (let k = 0; k < versions.length; k++) {
      if (!versions[k]) continue;
      const c = outlines[slotKey({ kind: 'glyph', ch, version: k as 0 | 1 | 2 })];
      if (!c) return null;
      list.push(c);
    }
    if (list.length) glyphs.set(ch, list);
  }
  const pairs = new Map<string, Contour[]>();
  for (const pair of Object.keys(project.pairs)) {
    const c = outlines[slotKey({ kind: 'pair', pair })];
    if (!c) return null;
    pairs.set(pair, c);
  }
  const { settings } = project;
  return {
    family: project.name,
    designer: project.designer,
    date: new Date(),
    penSize: PENS[settings.pen].size * settings.weight,
    tidy: settings.tidy,
    spacing: settings.spacing,
    glyphs,
    pairs,
  };
}

let generation = 0;
let previous: FontFace | null = null;

async function rebuild() {
  const { project, outlines } = useStudio.getState();
  const input = projectOutlines(project, outlines);
  if (!input || !input.glyphs.size) return;
  const mine = ++generation;
  useLiveFont.setState({ building: true });
  try {
    const result = await fontWorker().build(input);
    if (mine !== generation) return;
    const family = `HFM Live ${mine}`;
    const face = new FontFace(family, result.otf);
    await face.load();
    if (mine !== generation) return;
    document.fonts.add(face);
    if (previous) document.fonts.delete(previous);
    previous = face;
    useLiveFont.setState({ family, chars: new Set(result.chars), building: false, failed: false, builtAt: performance.now(), kerningPairs: result.kerningPairs });
  } catch {
    if (mine === generation) useLiveFont.setState({ building: false, failed: true });
  }
}

/** Rebuild the live font shortly after drawings, outlines or settings change. The old font stays up meanwhile. */
export function startFontPipeline() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, REBUILD_DELAY);
  };
  schedule();
  return useStudio.subscribe((s, prev) => {
    if (s.project !== prev.project || s.outlines !== prev.outlines) schedule();
  });
}
