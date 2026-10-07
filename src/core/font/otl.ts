import { Writer } from './sfnt';

// Shared OpenType Layout structures for GSUB and GPOS: script and feature lists, lookups, coverage, class defs.

export type Subtable = Uint8Array;
export type Lookup = {
  type: number;
  subtables: Subtable[];
  /**
   * Wrap each subtable in an Extension lookup (GSUB 7 / GPOS 9) whose 32-bit offset points at data placed
   * after everything else. Needed when the subtables are too big to sit behind 16-bit offsets.
   */
  extension?: boolean;
};
export type Feature = { tag: string; lookups: number[] };

const SCRIPTS = ['DFLT', 'latn'];

export function writeCoverage(w: Writer, glyphs: number[]) {
  const sorted = [...new Set(glyphs)].sort((a, b) => a - b);
  w.u16(1);
  w.u16(sorted.length);
  for (const g of sorted) w.u16(g);
}

/** ClassDef format 1: one class value for every glyph id from the first to the last classified glyph. */
export function writeClassDef(w: Writer, classOf: Map<number, number>) {
  const ids = [...classOf.keys()].sort((a, b) => a - b);
  if (!ids.length) {
    w.u16(1);
    w.u16(0);
    w.u16(0);
    return;
  }
  const first = ids[0]!, last = ids[ids.length - 1]!;
  w.u16(1);
  w.u16(first);
  w.u16(last - first + 1);
  for (let id = first; id <= last; id++) w.u16(classOf.get(id) ?? 0);
}

/** A complete GSUB or GPOS table. Every feature is registered under DFLT and latn's default language. */
export function writeLayoutTable(features: Feature[], lookups: Lookup[], extensionType: number): Uint8Array {
  const sorted = [...features].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const w = new Writer();
  w.u16(1);
  w.u16(0);
  const scriptListAt = w.slot(), featureListAt = w.slot(), lookupListAt = w.slot();

  w.patch(scriptListAt, 0);
  const scriptList = w.pos;
  w.u16(SCRIPTS.length);
  const scriptSlots = SCRIPTS.map((tag) => {
    w.tag(tag);
    return w.slot();
  });
  for (const slot of scriptSlots) {
    w.patch(slot, scriptList);
    const script = w.pos;
    const langSysAt = w.slot();
    w.u16(0);
    w.patch(langSysAt, script);
    w.u16(0);
    w.u16(0xffff);
    w.u16(sorted.length);
    sorted.forEach((_, i) => w.u16(i));
  }

  w.patch(featureListAt, 0);
  const featureList = w.pos;
  w.u16(sorted.length);
  const featureSlots = sorted.map((f) => {
    w.tag(f.tag);
    return w.slot();
  });
  sorted.forEach((f, i) => {
    w.patch(featureSlots[i]!, featureList);
    w.u16(0);
    w.u16(f.lookups.length);
    for (const l of f.lookups) w.u16(l);
  });

  w.patch(lookupListAt, 0);
  const lookupList = w.pos;
  w.u16(lookups.length);
  const lookupSlots = lookups.map(() => w.slot());
  const deferred: { at: number; base: number; data: Subtable }[] = [];
  lookups.forEach((lookup, i) => {
    w.patch(lookupSlots[i]!, lookupList);
    const start = w.pos;
    w.u16(lookup.extension ? extensionType : lookup.type);
    w.u16(0);
    w.u16(lookup.subtables.length);
    const subSlots = lookup.subtables.map(() => w.slot());
    lookup.subtables.forEach((data, k) => {
      w.patch(subSlots[k]!, start);
      if (lookup.extension) {
        const ext = w.pos;
        w.u16(1);
        w.u16(lookup.type);
        deferred.push({ at: w.slot32(), base: ext, data });
      } else w.raw(data);
    });
  });
  for (const { at, base, data } of deferred) {
    w.patch32(at, base);
    w.raw(data);
  }
  return w.finish();
}
