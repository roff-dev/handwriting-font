import type { Point } from '../geometry';

/** A 3 × 3 projective transform, row-major, with h[8] = 1. */
export type Homography = number[];

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r]![i]!) > Math.abs(A[p]![i]!)) p = r;
    [A[i], A[p]] = [A[p]!, A[i]!];
    [b[i], b[p]] = [b[p]!, b[i]!];
    for (let r = i + 1; r < n; r++) {
      const f = A[r]![i]! / A[i]![i]!;
      for (let c = i; c < n; c++) A[r]![c]! -= f * A[i]![c]!;
      b[r]! -= f * b[i]!;
    }
  }
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]!;
    for (let c = i + 1; c < n; c++) s -= A[i]![c]! * x[c]!;
    x[i] = s / A[i]![i]!;
  }
  return x;
}

/**
 * Least-squares homography from point pairs (direct linear transform with h33 = 1, solved through the
 * normal equations). Four pairs fit exactly; the 12–16 marker corners of a photo average out each
 * corner's detection error.
 */
export function homography(src: Point[], dst: Point[]): Homography {
  const AtA = Array.from({ length: 8 }, () => new Array<number>(8).fill(0)), Atb = new Array<number>(8).fill(0);
  src.forEach(([x, y], i) => {
    const [u, v] = dst[i]!;
    const rows: [number[], number][] = [
      [[x, y, 1, 0, 0, 0, -u * x, -u * y], u],
      [[0, 0, 0, x, y, 1, -v * x, -v * y], v],
    ];
    for (const [row, rhs] of rows) for (let r = 0; r < 8; r++) {
      Atb[r]! += row[r]! * rhs;
      for (let c = 0; c < 8; c++) AtA[r]![c]! += row[r]! * row[c]!;
    }
  });
  return [...solve(AtA, Atb), 1];
}

export function project(h: Homography, [x, y]: Point): Point {
  const w = h[6]! * x + h[7]! * y + h[8]!;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
}
