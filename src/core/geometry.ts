export type Point = [number, number];
export type Cubic = [Point, Point, Point, Point];
/** A closed outline made of cubic Bézier segments, each starting where the previous one ended. */
export type Contour = Cubic[];
export type Ring = Point[];
export type Bounds = { x0: number; y0: number; x1: number; y1: number };

export const lerp = (p: Point, q: Point, t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

export const line = (p: Point, q: Point): Cubic => [p, lerp(p, q, 1 / 3), lerp(p, q, 2 / 3), q];

/** Signed area; positive when the ring runs anticlockwise in y-up coordinates. */
export function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i]!, q = ring[(i + 1) % n]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function cubicAt([p0, c1, c2, p3]: Cubic, t: number): Point {
  const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]];
}

/** Polyline through each segment's start and `steps − 1` interior samples; the ring closes on itself. */
export function flatten(contour: Contour, steps = 12): Ring {
  const out: Ring = [];
  for (const seg of contour) for (let i = 0; i < steps; i++) out.push(cubicAt(seg, i / steps));
  return out;
}

/** Parameters in (0, 1) where one coordinate of a cubic has a turning point (roots of its derivative). */
function extrema(a: number, b: number, c: number, d: number, out: number[]) {
  const qa = -a + 3 * b - 3 * c + d, qb = 2 * (a - 2 * b + c), qc = b - a;
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) out.push(-qc / qb);
    return;
  }
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return;
  const s = Math.sqrt(disc);
  out.push((-qb + s) / (2 * qa), (-qb - s) / (2 * qa));
}

/** Exact bounding box of the curves (not their control points). */
export function bounds(contours: Contour[]): Bounds {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const ts: number[] = [];
  const add = ([x, y]: Point) => {
    if (x < b.x0) b.x0 = x;
    if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
  };
  for (const c of contours) for (const seg of c) {
    add(seg[0]);
    add(seg[3]);
    ts.length = 0;
    extrema(seg[0][0], seg[1][0], seg[2][0], seg[3][0], ts);
    extrema(seg[0][1], seg[1][1], seg[2][1], seg[3][1], ts);
    for (const t of ts) if (t > 0 && t < 1) add(cubicAt(seg, t));
  }
  return b;
}

/** Exact signed area of a closed cubic contour (Green's theorem); positive when anticlockwise in y-up. */
export function contourArea(contour: Contour): number {
  let a = 0;
  for (const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] of contour) {
    a += (3 * ((y3 - y0) * (x1 + x2) - (x3 - x0) * (y1 + y2) + y1 * (x0 - x2) - x1 * (y0 - y2) + y3 * (x2 + x0 / 3) - x3 * (y2 + y0 / 3))) / 20;
  }
  return a;
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function pointInRing([x, y]: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const mapContours = (contours: Contour[], f: (p: Point) => Point): Contour[] =>
  contours.map((c) => c.map((seg) => seg.map(f) as Cubic));
