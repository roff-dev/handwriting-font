import { create } from 'zustand';
import type { Contour } from '../core/geometry';
import type { Cell } from '../core/template/layout';
import type { Stroke } from '../core/ink/strokes';
import { emptyProject, type Project, type Settings } from '../core/project/schema';
import { MAX_PAIRS } from '../core/project/sets';
import { isDone, sameSlot, sequence, slotKey, type Slot } from './slots';

export type Tab = 'write' | 'test' | 'export' | 'paper';
export type StorageState = 'unknown' | 'ok' | 'unavailable';

type State = {
  project: Project;
  cursor: Slot;
  draft: Stroke[];
  past: Stroke[][];
  future: Stroke[][];
  /** Fitted outlines by slot, filled in by the glyph workers. */
  outlines: Record<string, Contour[]>;
  tab: Tab;
  penSeen: boolean;
  fingerAllowed: boolean;
  storage: StorageState;
  /** The last slot committed, for the flight animation. */
  committed: { slot: Slot; strokes: Stroke[]; at: number } | null;
  alphabetNoticeSeen: boolean;
  /** Everything in the chosen sets is drawn: the Write tab shows the finished state instead of the pad. */
  finished: boolean;
  moreOpen: boolean;

  addStroke: (s: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  commit: () => void;
  skip: () => void;
  select: (slot: Slot) => void;
  setTab: (tab: Tab) => void;
  setSettings: (s: Partial<Settings>) => void;
  setNames: (n: { name?: string; designer?: string }) => void;
  addPair: (pair: string) => void;
  /** Glyphs read from a photo of the template; then back to the pad at the first character still to draw. */
  addPhotoGlyphs: (glyphs: { cell: Cell; contours: Contour[] }[]) => void;
  setOutline: (key: string, contours: Contour[]) => void;
  replaceProject: (p: Project) => void;
  penDetected: () => void;
  allowFinger: (allowed: boolean) => void;
  setStorage: (s: StorageState) => void;
  dismissAlphabetNotice: () => void;
  setMoreOpen: (open: boolean) => void;
};

const FIRST: Slot = { kind: 'glyph', ch: 'a', version: 0 };

function strokesFor(project: Project, slot: Slot): Stroke[] {
  const v = slot.kind === 'pair' ? project.pairs[slot.pair] : project.glyphs[slot.ch]?.[slot.version];
  return v?.source === 'pen' ? v.strokes : [];
}

/** The next slot after `from` that hasn't been drawn, wrapping round; `from` itself if everything is done. */
export function nextOpen(project: Project, from: Slot): Slot {
  const seq = sequence(project);
  const at = seq.findIndex((s) => sameSlot(s, from));
  for (let i = 1; i <= seq.length; i++) {
    const s = seq[(at + i) % seq.length]!;
    if (!isDone(project, s)) return s;
  }
  return from;
}

export const allDone = (project: Project) => sequence(project).every((s) => isDone(project, s));

export const firstOpen = (project: Project): Slot => {
  const seq = sequence(project);
  return seq.find((s) => !isDone(project, s)) ?? seq[0] ?? FIRST;
};

export const useStudio = create<State>((set, get) => ({
  project: emptyProject(),
  cursor: FIRST,
  draft: [],
  past: [],
  future: [],
  outlines: {},
  tab: 'write',
  penSeen: false,
  fingerAllowed: true,
  storage: 'unknown',
  committed: null,
  alphabetNoticeSeen: false,
  finished: false,
  moreOpen: false,

  addStroke: (s) => set(({ draft, past }) => ({ draft: [...draft, s], past: [...past, draft], future: [] })),
  undo: () =>
    set(({ draft, past, future }) => (past.length ? { draft: past[past.length - 1]!, past: past.slice(0, -1), future: [draft, ...future] } : {})),
  redo: () =>
    set(({ draft, past, future }) => (future.length ? { draft: future[0]!, past: [...past, draft], future: future.slice(1) } : {})),
  clear: () => set(({ draft, past }) => (draft.length ? { draft: [], past: [...past, draft], future: [] } : {})),

  commit: () => {
    const { project, cursor, draft } = get();
    if (!draft.length) return;
    const variant = { source: 'pen' as const, strokes: draft, updatedAt: Date.now() };
    let next: Project;
    if (cursor.kind === 'pair') next = { ...project, pairs: { ...project.pairs, [cursor.pair]: variant } };
    else {
      const versions = [...(project.glyphs[cursor.ch] ?? [])];
      versions[Math.min(cursor.version, versions.length)] = variant;
      next = { ...project, glyphs: { ...project.glyphs, [cursor.ch]: versions } };
    }
    const committed = { slot: cursor, strokes: draft, at: variant.updatedAt };
    if (allDone(next)) {
      set({ project: next, committed, finished: true, draft: [], past: [], future: [] });
      return;
    }
    const to = nextOpen(next, cursor);
    set({ project: next, committed, cursor: to, draft: strokesFor(next, to), past: [], future: [] });
  },

  skip: () => {
    const { project, cursor } = get();
    const seq = sequence(project), at = seq.findIndex((s) => sameSlot(s, cursor));
    const to = seq[(at + 1) % seq.length] ?? cursor;
    set({ cursor: to, draft: strokesFor(project, to), past: [], future: [] });
  },

  select: (slot) => set(({ project }) => ({ cursor: slot, draft: strokesFor(project, slot), past: [], future: [], tab: 'write', finished: false })),
  setTab: (tab) => set({ tab }),
  setSettings: (s) =>
    set(({ project, finished }) => {
      const next = { ...project, settings: { ...project.settings, ...s } };
      // Adding a set after finishing brings its first character straight to the pad.
      if (finished && !allDone(next)) {
        const cursor = firstOpen(next);
        return { project: next, finished: false, cursor, draft: strokesFor(next, cursor), past: [], future: [] };
      }
      return { project: next };
    }),
  setNames: (n) => set(({ project }) => ({ project: { ...project, ...n } })),

  addPair: (pair) =>
    set(({ project }) => {
      const sets = project.settings.sets.includes('pairs') ? project.settings.sets : [...project.settings.sets, 'pairs' as const];
      const slot: Slot = { kind: 'pair', pair };
      if (Object.keys(project.pairs).length >= MAX_PAIRS) return {};
      return { project: { ...project, settings: { ...project.settings, sets } }, cursor: slot, draft: strokesFor(project, slot), past: [], future: [], tab: 'write', finished: false };
    }),

  addPhotoGlyphs: (glyphs) =>
    set(({ project }) => {
      const updatedAt = Date.now(), all = { ...project.glyphs };
      for (const { cell, contours } of [...glyphs].sort((a, b) => a.cell.version - b.cell.version)) {
        const versions = [...(all[cell.ch] ?? [])];
        versions[Math.min(cell.version, versions.length)] = { source: 'photo', contours, updatedAt };
        all[cell.ch] = versions;
      }
      const next = { ...project, glyphs: all };
      const cursor = firstOpen(next);
      return { project: next, cursor, draft: strokesFor(next, cursor), past: [], future: [], tab: 'write', finished: allDone(next) };
    }),

  setOutline: (key, contours) => set(({ outlines }) => ({ outlines: { ...outlines, [key]: contours } })),

  replaceProject: (p) => {
    const cursor = firstOpen(p);
    set({ project: p, cursor, draft: strokesFor(p, cursor), past: [], future: [], outlines: {}, committed: null, finished: allDone(p) });
  },

  penDetected: () => set(({ penSeen }) => (penSeen ? {} : { penSeen: true, fingerAllowed: false })),
  allowFinger: (allowed) => set({ fingerAllowed: allowed }),
  setStorage: (storage) => set({ storage }),
  dismissAlphabetNotice: () => set({ alphabetNoticeSeen: true }),
  setMoreOpen: (moreOpen) => set({ moreOpen }),
}));

export { slotKey };
