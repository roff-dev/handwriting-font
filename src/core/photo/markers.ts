import aruco from '../../vendor/aruco';
import type { Point } from '../geometry';
import { identify, MARKER_DICTIONARY, markerCorners, type PaperSize } from '../template/layout';
import { boxBlur, flattenLighting, greyscale, sample, type Photo } from './image';

export type FoundMarker = { id: number; corners: Point[] };
export type PageFix = { size: PaperSize; page: number; markers: FoundMarker[] };

const SCALES = [1, 0.75, 0.5, 0.35];

/**
 * Find the corner markers. Raw detection missed markers in a third of ordinary photos and all the hard
 * ones in the spike, mostly in shadows and blur, so each attempt first flattens the lighting, and the
 * detector runs at several scales until all four are found.
 */
export function findMarkers(photo: Photo): FoundMarker[] {
  const { width: W, height: H } = photo;
  const grey = greyscale(photo);
  const detector = new aruco.AR.Detector({ dictionaryName: MARKER_DICTIONARY });
  const best = new Map<number, FoundMarker>();
  for (const scale of SCALES) {
    const w = Math.round(W * scale), h = Math.round(H * scale);
    const small = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) small[y * w + x] = grey[Math.min(H - 1, Math.round(y / scale)) * W + Math.min(W - 1, Math.round(x / scale))]!;
    const bg = boxBlur(small, w, h, Math.round(w / 25));
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = Math.min(255, (small[i]! / Math.max(1, bg[i]!)) * 220);
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    for (const m of detector.detect({ width: w, height: h, data })) {
      if (identify(m.id) && !best.has(m.id)) best.set(m.id, { id: m.id, corners: m.corners.map((c): Point => [c.x / scale, c.y / scale]) });
    }
    if (best.size >= 4 && pageOf([...best.values()])?.markers.length === 4) break;
  }
  const flat = flattenLighting(grey, W, H, Math.round(W / 30));
  return [...best.values()].map((m) => ({ ...m, corners: refineCorners(flat, W, H, m.corners) }));
}

type Line = { point: Point; dir: Point };

/** Least-squares line through points (principal axis). */
function fitLine(points: Point[]): Line {
  const n = points.length, mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { point: [mx, my], dir: [Math.cos(angle), Math.sin(angle)] };
}

function intersect(a: Line, b: Line): Point | null {
  const det = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0];
  if (Math.abs(det) < 1e-9) return null;
  const t = ((b.point[0] - a.point[0]) * b.dir[1] - (b.point[1] - a.point[1]) * b.dir[0]) / det;
  return [a.point[0] + t * a.dir[0], a.point[1] + t * a.dir[1]];
}

/**
 * Sub-pixel corners. The detector's corners can be 2–4 px out on a blurry photo, and with only three
 * markers that error grows towards the far corner of the page. Each marker is a black square on white
 * paper, so find where the image crosses halfway from dark to light at points along each edge, fit a
 * line through them, and take the corners where neighbouring lines meet.
 */
export function refineCorners(flat: Float32Array, W: number, H: number, corners: Point[]): Point[] {
  const cx = corners.reduce((s, p) => s + p[0], 0) / 4, cy = corners.reduce((s, p) => s + p[1], 0) / 4;
  const lines: (Line | null)[] = corners.map((a, k) => {
    const b = corners[(k + 1) % 4]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    // point the normal out of the marker, from its dark border to the paper
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) [nx, ny] = [-nx, -ny];
    const reach = Math.max(3, Math.min(10, len * 0.12)), step = 0.25;
    const edge: Point[] = [];
    for (let i = 1; i <= 12; i++) {
      const t = 0.12 + (0.76 * i) / 13, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      const profile: number[] = [];
      for (let d = -reach; d <= reach; d += step) profile.push(sample(flat, W, H, px + nx * d, py + ny * d, 1));
      const inside = Math.min(...profile), outside = Math.max(...profile);
      if (outside - inside < 0.2) continue;
      const half = (inside + outside) / 2;
      // the crossing nearest the detected edge, going from the dark inside to the light outside
      let found: number | null = null;
      for (let j = 1; j < profile.length; j++) {
        const p0 = profile[j - 1]!, p1 = profile[j]!;
        if (p0 < half && p1 >= half) {
          const d = -reach + (j - 1 + (half - p0) / (p1 - p0)) * step;
          if (found === null || Math.abs(d) < Math.abs(found)) found = d;
        }
      }
      if (found !== null) edge.push([px + nx * found, py + ny * found]);
    }
    return edge.length >= 6 ? fitLine(edge) : null;
  });
  return corners.map((c, k) => {
    const before = lines[(k + 3) % 4], after = lines[k];
    const p = before && after ? intersect(before, after) : null;
    return p && Math.hypot(p[0] - c[0], p[1] - c[1]) < 8 ? p : c;
  });
}

/** Which page and paper the markers belong to; the page with the most markers wins. */
export function pageOf(markers: FoundMarker[]): PageFix | null {
  const groups = new Map<string, PageFix>();
  for (const m of markers) {
    const where = identify(m.id)!, key = `${where.size}:${where.page}`;
    const g = groups.get(key) ?? { size: where.size, page: where.page, markers: [] };
    g.markers.push(m);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.markers.length - a.markers.length)[0] ?? null;
}

/** Point pairs (page points → photo pixels) from every corner of every marker found. */
export function markerPairs(fix: PageFix): { page: Point[]; photo: Point[] } {
  const page: Point[] = [], photo: Point[] = [];
  for (const m of fix.markers) {
    const corners = markerCorners(fix.size, identify(m.id)!.corner);
    m.corners.forEach((c, k) => {
      page.push(corners[k]!);
      photo.push(c);
    });
  }
  return { page, photo };
}
