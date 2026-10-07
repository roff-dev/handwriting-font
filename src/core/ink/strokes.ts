import { getStroke } from 'perfect-freehand';
import type { Ring } from '../geometry';

export type PointerKind = 'pen' | 'touch' | 'mouse';

/** Points are packed as x, y, pressure, t (ms since the stroke began), in font units. */
export type Stroke = { points: Float32Array; pointerType: PointerKind };

export type PenId = 'fineliner' | 'felt' | 'ink';
export type Pen = { size: number; thinning: number };

export const PENS: Record<PenId, Pen> = {
  fineliner: { size: 56, thinning: 0 },
  felt: { size: 76, thinning: 0.12 },
  ink: { size: 64, thinning: 0.55 },
};

export const WEIGHT_RANGE = { min: 0.6, max: 1.6, step: 0.05 } as const;

const SMOOTHING = 0.5;
const STREAMLINE = 0.35;

/**
 * Real pressure is trusted only from a pen that actually varies it. Hardware without pressure reports a
 * constant 0.5 (MDN), so anything else falls back to perfect-freehand's velocity-based simulation.
 */
export function usesRealPressure(stroke: Stroke): boolean {
  if (stroke.pointerType !== 'pen') return false;
  const seen = new Set<number>();
  for (let i = 2; i < stroke.points.length; i += 4) {
    seen.add(stroke.points[i]!);
    if (seen.size >= 3) return true;
  }
  return false;
}

export function strokePoints(stroke: Stroke): [number, number, number][] {
  const p = stroke.points, out: [number, number, number][] = [];
  for (let i = 0; i < p.length; i += 4) out.push([p[i]!, p[i + 1]!, p[i + 2]!]);
  return out;
}

/** The filled outline of one stroke as a polygon. It usually crosses itself; see `outline.ts`. */
export function strokeOutline(stroke: Stroke, pen: Pen, weight: number, last = true): Ring {
  return getStroke(strokePoints(stroke), {
    size: pen.size * weight,
    thinning: pen.thinning,
    smoothing: SMOOTHING,
    streamline: STREAMLINE,
    simulatePressure: !usesRealPressure(stroke),
    last,
  }) as Ring;
}
