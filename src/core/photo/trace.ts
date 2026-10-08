import type { Point, Ring } from '../geometry';

/** Keep only connected ink regions of at least `minArea` samples: pen ink stays, dust and paper grain go. */
export function dropSpecks(bin: Uint8Array, w: number, h: number, minArea: number): Uint8Array {
  const label = new Int32Array(w * h), out = new Uint8Array(w * h);
  let next = 1;
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || label[s]) continue;
    const stack = [s], region: number[] = [];
    label[s] = next;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (bin[q] && !label[q]) {
          label[q] = next;
          stack.push(q);
        }
      }
    }
    if (region.length >= minArea) for (const p of region) out[p] = 1;
    next++;
  }
  return out;
}

/**
 * Bitmap → closed outlines along pixel edges, ink kept on one side. Where two diagonal pixels touch, the
 * walk turns the same way every time, so outlines never cross. Edge midpoints remove the staircase bias.
 */
export function traceBitmap(img: Uint8Array, w: number, h: number): Ring[] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? img[y * w + x]! : 0);
  const next = new Map<number, [number, number][]>();
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = y0 * (w + 1) + x0, list = next.get(k);
    if (list) list.push([x1, y1]);
    else next.set(k, [[x1, y1]]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!img[y * w + x]) continue;
    if (!at(x, y - 1)) add(x + 1, y, x, y);
    if (!at(x, y + 1)) add(x, y + 1, x + 1, y + 1);
    if (!at(x - 1, y)) add(x, y, x, y + 1);
    if (!at(x + 1, y)) add(x + 1, y + 1, x + 1, y);
  }
  const loops: Ring[] = [];
  for (const [k0, list] of next) {
    while (list.length) {
      let x = k0 % (w + 1), y = Math.floor(k0 / (w + 1));
      const loop: Point[] = [[x, y]];
      let [nx, ny] = list.pop()!;
      let pdx = nx - x, pdy = ny - y;
      [x, y] = [nx, ny];
      for (let guard = 0; y * (w + 1) + x !== k0 && guard < 1e7; guard++) {
        loop.push([x, y]);
        const options = next.get(y * (w + 1) + x);
        if (!options?.length) break;
        let pick = 0;
        if (options.length > 1) {
          let best = -Infinity;
          options.forEach(([cx, cy], i) => {
            const turn = pdx * (cy - y) - pdy * (cx - x);
            if (turn > best) [best, pick] = [turn, i];
          });
        }
        [nx, ny] = options.splice(pick, 1)[0]!;
        pdx = nx - x;
        pdy = ny - y;
        [x, y] = [nx, ny];
      }
      if (loop.length > 3) loops.push(loop);
    }
  }
  return loops.map((l) => l.map((p, i): Point => {
    const q = l[(i + 1) % l.length]!;
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  }));
}

/** One pass of [1 2 1] smoothing around a closed ring. */
export const smoothRing = (ring: Ring): Ring =>
  ring.map((p, i) => {
    const a = ring[(i - 1 + ring.length) % ring.length]!, c = ring[(i + 1) % ring.length]!;
    return [(a[0] + 2 * p[0] + c[0]) / 4, (a[1] + 2 * p[1] + c[1]) / 4];
  });
