import { bounds, type Bounds, type Contour } from '../geometry';
import { zoneProfile } from './profiles';

export const SPACING_RANGE = { min: 0.75, max: 1.35, step: 0.05 } as const;
const MIN_SIDEBEARING = 8;

export type SpacingParams = { xHeight: number; capHeight: number; penSize: number; spacing: number };
export type Sidebearings = { lsb: number; rsb: number; bounds: Bounds; depth: { left: number; right: number } };

/** The gap every glyph aims for, before its own shape is accounted for. */
export const targetGap = ({ xHeight, penSize, spacing }: SpacingParams) => Math.round((0.075 * xHeight + 0.35 * penSize) * spacing);

/**
 * Optical sidebearings: average how far the ink recedes from each side's extreme across the glyph's
 * zone, clamped so open shapes (c, r, L) aren't swallowed, and give back that much less space. Round
 * and open sides end up closer to their neighbours, straight stems further away.
 */
export function sidebearings(contours: Contour[], capitalZone: boolean, p: SpacingParams): Sidebearings {
  const b = bounds(contours);
  const depthCap = 0.22 * p.xHeight;
  const zone = capitalZone ? p.capHeight : p.xHeight;
  const top = Math.min(b.y1, zone), bottom = Math.max(b.y0, 0);
  const [y0, y1] = top - bottom > 40 ? [bottom, top] : [b.y0, b.y1];
  const { left, right } = zoneProfile(contours, y0, y1);
  const meanDepth = (edges: Float64Array, edge: number, sign: 1 | -1) => {
    let sum = 0;
    for (const v of edges) sum += Number.isFinite(v) ? Math.min(depthCap, sign * (v - edge)) : depthCap;
    return sum / edges.length;
  };
  const dl = meanDepth(left, b.x0, 1), dr = meanDepth(right, b.x1, -1), t = targetGap(p);
  return {
    lsb: Math.max(MIN_SIDEBEARING, Math.round(t - dl)),
    rsb: Math.max(MIN_SIDEBEARING, Math.round(t - dr)),
    bounds: b,
    depth: { left: dl, right: dr },
  };
}

export const spaceAdvance = (lowercaseAdvances: number[]) =>
  lowercaseAdvances.length ? Math.round((0.55 * lowercaseAdvances.reduce((a, b) => a + b, 0)) / lowercaseAdvances.length) : 250;
