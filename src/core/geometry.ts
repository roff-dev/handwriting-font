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

export function bounds(contours: Contour[], steps = 8): Bounds {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const c of contours) for (const [x, y] of flatten(c, steps)) {
    if (x < b.x0) b.x0 = x;
    if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
  }
  return b;
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
