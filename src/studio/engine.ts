import type { Project } from '../core/project/schema';
import { GlyphPool } from '../workers/pool';
import { sequence, slotKey, type Slot } from './slots';
import { useStudio } from './store';

let pool: GlyphPool | undefined;
/** What each slot's outline was last requested for, so stale results are dropped. */
const requested = new Map<string, string>();

function sync(project: Project) {
  pool ??= new GlyphPool();
  const { pen, weight } = project.settings;
  const order = new Map(sequence(project).map((s, i) => [slotKey(s), i]));
  const want = (slot: Slot, variant: Project['pairs'][string] | Project['glyphs'][string][number]) => {
    const key = slotKey(slot), signature = `${variant.updatedAt}:${pen}:${weight}`;
    if (requested.get(key) === signature) return;
    requested.set(key, signature);
    // Grid order doubles as priority, so after a weight change the glyphs near the top come back first.
    const priority = order.get(key) ?? order.size;
    const job = variant.source === 'photo' ? pool!.inflate(variant.contours, weight, priority) : pool!.outline(variant.strokes, pen, weight, priority);
    job.then((contours) => {
      if (requested.get(key) === signature) useStudio.getState().setOutline(key, contours);
    });
  };
  for (const [ch, versions] of Object.entries(project.glyphs)) versions.forEach((v, k) => v && want({ kind: 'glyph', ch, version: k as 0 | 1 | 2 }, v));
  for (const [pair, v] of Object.entries(project.pairs)) want({ kind: 'pair', pair }, v);
}

export function startEngine() {
  sync(useStudio.getState().project);
  return useStudio.subscribe((state, prev) => {
    // A newly opened project starts with no outlines, even for glyphs requested before.
    if (state.outlines !== prev.outlines && !Object.keys(state.outlines).length) requested.clear();
    if (state.project !== prev.project || requested.size === 0) sync(state.project);
  });
}
