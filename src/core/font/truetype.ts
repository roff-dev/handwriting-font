import type { Contour, Cubic, Point } from '../geometry';
import { cubicAt, lerp } from '../geometry';
import { reverseContour } from '../ink/orient';
import { readTables, writeSfnt } from './sfnt';

type Quad = [Point, Point, Point];

const quadAt = (a: Point, b: Point, c: Point, t: number): Point => {
  const m = 1 - t;
  return [m * m * a[0] + 2 * m * t * b[0] + t * t * c[0], m * m * a[1] + 2 * m * t * b[1] + t * t * c[1]];
};

function splitCubic(c: Cubic, t0: number, t1: number): Cubic {
  const at = (s: Cubic, t: number): [Cubic, Cubic] => {
    const ab = lerp(s[0], s[1], t), bc = lerp(s[1], s[2], t), cd = lerp(s[2], s[3], t);
    const abc = lerp(ab, bc, t), bcd = lerp(bc, cd, t), mid = lerp(abc, bcd, t);
    return [[s[0], ab, abc, mid], [mid, bcd, cd, s[3]]];
  };
  const right = t0 > 0 ? at(c, t0)[1] : c;
  return t1 < 1 ? at(right, (t1 - t0) / (1 - t0))[0] : right;
}

/** Approximate a cubic with the fewest quadratics (1–8) whose error stays within `tol` font units. */
export function cubicToQuads(c: Cubic, tol: number): Quad[] {
  let quads: Quad[] = [];
  for (let n = 1; n <= 8; n++) {
    quads = [];
    let worst = 0;
    for (let i = 0; i < n; i++) {
      const s = splitCubic(c, i / n, (i + 1) / n);
      const ctrl: Point = [(3 * (s[1][0] + s[2][0]) - s[0][0] - s[3][0]) / 4, (3 * (s[1][1] + s[2][1]) - s[0][1] - s[3][1]) / 4];
      for (let k = 1; k < 8; k++) {
        const p = cubicAt(s, k / 8), q = quadAt(s[0], ctrl, s[3], k / 8);
        worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1]));
      }
      quads.push([s[0], ctrl, s[3]]);
    }
    if (worst <= tol) break;
  }
  return quads;
}

type EncodedGlyph = { bytes: Uint8Array; xMin: number; yMin: number; xMax: number; yMax: number; points: number; contours: number };

/** One glyph → `glyf` record. TrueType winds outer contours clockwise, the opposite of CFF, so reverse. */
function encodeGlyph(contours: Contour[], tol: number): EncodedGlyph {
  const pts: [number, number, boolean][] = [], ends: number[] = [];
  for (const c of contours) {
    if (!c.length) continue;
    for (const cubic of reverseContour(c)) for (const [start, ctrl] of cubicToQuads(cubic, tol)) {
      pts.push([Math.round(start[0]), Math.round(start[1]), true]);
      pts.push([Math.round(ctrl[0]), Math.round(ctrl[1]), false]);
    }
    ends.push(pts.length - 1);
  }
  if (!pts.length) return { bytes: new Uint8Array(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0, points: 0, contours: 0 };
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const [x, y] of pts) {
    xMin = Math.min(xMin, x); yMin = Math.min(yMin, y); xMax = Math.max(xMax, x); yMax = Math.max(yMax, y);
  }
  const flags: number[] = [], xs: number[] = [], ys: number[] = [];
  let px = 0, py = 0;
  for (const [x, y, onCurve] of pts) {
    let f = onCurve ? 1 : 0;
    const dx = x - px, dy = y - py;
    px = x;
    py = y;
    if (dx === 0) f |= 0x10;
    else if (Math.abs(dx) < 256) {
      f |= 0x02 | (dx > 0 ? 0x10 : 0);
      xs.push(Math.abs(dx));
    } else xs.push((dx >> 8) & 255, dx & 255);
    if (dy === 0) f |= 0x20;
    else if (Math.abs(dy) < 256) {
      f |= 0x04 | (dy > 0 ? 0x20 : 0);
      ys.push(Math.abs(dy));
    } else ys.push((dy >> 8) & 255, dy & 255);
    flags.push(f);
  }
  const head: number[] = [];
  const u16 = (v: number) => head.push((v >> 8) & 255, v & 255);
  u16(ends.length);
  [xMin, yMin, xMax, yMax].forEach((v) => u16(v & 0xffff));
  ends.forEach(u16);
  u16(0);
  const all = [...head, ...flags, ...xs, ...ys];
  if (all.length % 2) all.push(0);
  return { bytes: Uint8Array.from(all), xMin, yMin, xMax, yMax, points: pts.length, contours: ends.length };
}

/**
 * TrueType flavour of a CFF font built by `buildFont`: the same tables, with `glyf`/`loca` converted from
 * the cubic outlines (within `tol` units), `maxp` 1.0, left sidebearings set to each glyph's xMin, and
 * `post` 3.0.
 */
export function toTrueType(otf: ArrayBuffer, outlines: Contour[][], tol = 1): ArrayBuffer {
  const tables = readTables(otf);
  const enc = outlines.map((c) => encodeGlyph(c, tol));
  const inked = enc.filter((g) => g.bytes.length);

  const glyf = new Uint8Array(enc.reduce((a, g) => a + g.bytes.length, 0));
  const loca = new Uint8Array((enc.length + 1) * 4), lv = new DataView(loca.buffer);
  let offset = 0;
  enc.forEach((g, i) => {
    lv.setUint32(i * 4, offset);
    glyf.set(g.bytes, offset);
    offset += g.bytes.length;
  });
  lv.setUint32(enc.length * 4, offset);

  const maxp = new Uint8Array(32), mv = new DataView(maxp.buffer);
  mv.setUint32(0, 0x00010000);
  mv.setUint16(4, enc.length);
  mv.setUint16(6, Math.max(...enc.map((g) => g.points)));
  mv.setUint16(8, Math.max(...enc.map((g) => g.contours)));
  mv.setUint16(14, 2);

  const hmtx = tables.get('hmtx')!.slice(), hv = new DataView(hmtx.buffer);
  enc.forEach((g, i) => hv.setInt16(i * 4 + 2, g.bytes.length ? g.xMin : 0));

  const head = tables.get('head')!.slice(), dv = new DataView(head.buffer);
  dv.setInt16(36, Math.min(...inked.map((g) => g.xMin)));
  dv.setInt16(38, Math.min(...inked.map((g) => g.yMin)));
  dv.setInt16(40, Math.max(...inked.map((g) => g.xMax)));
  dv.setInt16(42, Math.max(...inked.map((g) => g.yMax)));
  dv.setInt16(50, 1);

  const hhea = tables.get('hhea')!.slice(), hh = new DataView(hhea.buffer);
  const advance = (i: number) => hv.getUint16(i * 4);
  hh.setInt16(12, Math.min(...enc.map((g) => (g.bytes.length ? g.xMin : 0))));
  hh.setInt16(14, Math.min(...enc.map((g, i) => (g.bytes.length ? advance(i) - g.xMax : 0))));
  hh.setInt16(16, Math.max(...enc.map((g) => (g.bytes.length ? g.xMax : 0))));

  const post = new Uint8Array(32), pv = new DataView(post.buffer), src = new DataView(tables.get('post')!.buffer);
  pv.setUint32(0, 0x00030000);
  pv.setUint32(4, src.getUint32(4));
  pv.setInt16(8, src.getInt16(8));
  pv.setInt16(10, src.getInt16(10));

  tables.delete('CFF ');
  for (const [tag, data] of Object.entries({ glyf, loca, maxp, hmtx, head, hhea, post })) tables.set(tag, data);
  return writeSfnt(tables, 'truetype');
}
