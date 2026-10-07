import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import type { Contour } from '../geometry';
import type { PointerKind, Stroke } from '../ink/strokes';
import { DEFAULT_SETTINGS, type DrawnVariant, type Project, type Variant } from './schema';

type StoredStroke = { k: PointerKind; d: number[] };
type StoredVariant = { s: 'pen'; t: number; strokes: StoredStroke[] } | { s: 'photo'; t: number; contours: number[][] };

const SCALE = [10, 10, 255, 1];

/**
 * One stroke as a flat integer list of deltas: x·10, y·10, pressure·255 and t (ms), each relative to the
 * previous point. Handwriting moves a few units per sample, so the numbers are short and gzip well:
 * 282 glyphs went from 2.47 MB as raw float JSON to 196 KB.
 */
export function encodeStroke({ points, pointerType }: Stroke): StoredStroke {
  const d: number[] = [];
  const prev = [0, 0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    const q = Math.round(points[i]! * SCALE[i % 4]!);
    d.push(q - prev[i % 4]!);
    prev[i % 4] = q;
  }
  return { k: pointerType, d };
}

export function decodeStroke({ k, d }: StoredStroke): Stroke {
  const points = new Float32Array(d.length), acc = [0, 0, 0, 0];
  for (let i = 0; i < d.length; i++) {
    acc[i % 4]! += d[i]!;
    points[i] = acc[i % 4]! / SCALE[i % 4]!;
  }
  return { points, pointerType: k };
}

const flatContour = (c: Contour) => c.flatMap((seg) => seg.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
function unflatContour(flat: number[]): Contour {
  const out: Contour = [];
  for (let i = 0; i + 7 < flat.length; i += 8) {
    out.push([[flat[i]!, flat[i + 1]!], [flat[i + 2]!, flat[i + 3]!], [flat[i + 4]!, flat[i + 5]!], [flat[i + 6]!, flat[i + 7]!]]);
  }
  return out;
}

const storeVariant = (v: Variant): StoredVariant =>
  v.source === 'pen' ? { s: 'pen', t: v.updatedAt, strokes: v.strokes.map(encodeStroke) } : { s: 'photo', t: v.updatedAt, contours: v.contours.map(flatContour) };

const loadVariant = (v: StoredVariant): Variant =>
  v.s === 'pen' ? { source: 'pen', updatedAt: v.t, strokes: v.strokes.map(decodeStroke) } : { source: 'photo', updatedAt: v.t, contours: v.contours.map(unflatContour) };

export function serialize(project: Project): Uint8Array {
  const json = {
    format: 'hwfont',
    version: 1,
    name: project.name,
    designer: project.designer,
    settings: project.settings,
    glyphs: Object.fromEntries(Object.entries(project.glyphs).map(([ch, vs]) => [ch, vs.map(storeVariant)])),
    pairs: Object.fromEntries(Object.entries(project.pairs).map(([p, v]) => [p, storeVariant(v)])),
  };
  return gzipSync(strToU8(JSON.stringify(json)), { level: 9 });
}

export class NotAProjectError extends Error {
  constructor() {
    super("That isn't a Handwriting Font Maker project.");
  }
}

export function deserialize(bytes: Uint8Array): Project {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(strFromU8(gunzipSync(bytes)));
  } catch {
    throw new NotAProjectError();
  }
  if (json.format !== 'hwfont' || json.version !== 1 || typeof json.glyphs !== 'object') throw new NotAProjectError();
  const glyphs = json.glyphs as Record<string, StoredVariant[]>, pairs = (json.pairs ?? {}) as Record<string, StoredVariant>;
  return {
    format: 'hwfont',
    version: 1,
    name: typeof json.name === 'string' ? json.name : 'My Hand',
    designer: typeof json.designer === 'string' ? json.designer : '',
    settings: { ...DEFAULT_SETTINGS, ...(json.settings as object) },
    glyphs: Object.fromEntries(Object.entries(glyphs).map(([ch, vs]) => [ch, vs.map(loadVariant)])),
    pairs: Object.fromEntries(Object.entries(pairs).map(([p, v]) => [p, loadVariant(v) as DrawnVariant])),
  };
}
