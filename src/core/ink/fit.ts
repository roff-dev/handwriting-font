import fitCurve from 'fit-curve';
import { distToSegment, flatten, line, type Contour, type Cubic, type Point, type Ring } from '../geometry';

export type FitOptions = { maxError: number; cornerDeg: number; simplify: number };
export const PEN_FIT: FitOptions = { maxError: 1, cornerDeg: 70, simplify: 0.6 };

export function rdp(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s]!, [bx, by] = pts[e]!;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let worst = -1, at = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i]![0] - ax) * dy - (pts[i]![1] - ay) * dx) / len;
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > eps) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** RDP needs a baseline, and a closed ring's start and end coincide, so split it at its farthest point. */
export function simplifyRing(ring: Ring, eps: number): Ring {
  const pts = dedupe(ring);
  if (pts.length < 3) return pts;
  const [sx, sy] = pts[0]!;
  let far = 0, farDist = -1;
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - sx, y - sy);
    if (d > farDist) [farDist, far] = [d, i];
  });
  const a = rdp(pts.slice(0, far + 1), eps), b = rdp([...pts.slice(far), pts[0]!], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** Closed ring → cubic Béziers, keeping turns sharper than `cornerDeg` as corners. */
export function fitRing(ring: Ring, { maxError, cornerDeg, simplify }: FitOptions = PEN_FIT): Contour {
  const pts = simplifyRing(ring, simplify);
  const n = pts.length;
  if (n < 3) return [];
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]!, b = pts[i]!, c = pts[(i + 1) % n]!;
    const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
    const turn = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y)) * (180 / Math.PI);
    if (turn > cornerDeg) corners.push(i);
  }
  const starts = corners.length ? corners : [0];
  const out: Contour = [];
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k]!, e = starts[(k + 1) % starts.length]!;
    const run: Point[] = [pts[s]!];
    for (let i = (s + 1) % n; ; i = (i + 1) % n) {
      run.push(pts[i]!);
      if (i === e) break;
    }
    if (run.length === 2) out.push(line(run[0]!, run[1]!));
    else out.push(...guardedFit(run, maxError));
  }
  return out;
}

/**
 * Schneider's algorithm occasionally returns a curve that loops far away from the points it was given
 * (one test glyph strayed 294 units). Every curve is checked against its own points; one that strays
 * more than 3 × maxError is thrown away and the run is split in half and refitted.
 */
function guardedFit(run: Point[], maxError: number, depth = 0): Cubic[] {
  if (run.length <= 3 || depth > 8) return polyline(run);
  const curves = fitCurve(run, maxError) as Cubic[];
  if (curves.some((curve) => strayDistance(curve, run) > maxError * 3)) {
    const mid = run.length >> 1;
    return [...guardedFit(run.slice(0, mid + 1), maxError, depth + 1), ...guardedFit(run.slice(mid), maxError, depth + 1)];
  }
  return curves;
}

function strayDistance(curve: Cubic, run: Point[]): number {
  let worst = 0;
  for (const p of flatten([curve], 24)) {
    let nearest = Infinity;
    for (let i = 1; i < run.length; i++) nearest = Math.min(nearest, distToSegment(p, run[i - 1]!, run[i]!));
    if (nearest > worst) worst = nearest;
  }
  return worst;
}

const polyline = (run: Point[]): Cubic[] => run.slice(1).map((q, i) => line(run[i]!, q));

function dedupe(ring: Ring): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) out.push(p);
  }
  const first = out[0], last = out[out.length - 1];
  if (out.length > 1 && first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) out.pop();
  return out;
}
