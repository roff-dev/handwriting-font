import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { getStroke } from 'perfect-freehand';
import type { Contour } from '../../core/geometry';
import { PENS, strokeOutline, usesRealPressure, type PenId, type Stroke } from '../../core/ink/strokes';
import { aspect, GUIDE_LINES, LETTER_BOX, type PadBox } from './geometry';
import { usePointerInk, type LiveStroke } from './usePointerInk';
import { inkColours, mix, useInkColours } from './colours';
import './pad.css';

export type PadProps = {
  box?: PadBox;
  strokes: Stroke[];
  pen: PenId;
  weight: number;
  ignoreTouch: boolean;
  onPen?: () => void;
  onStroke: (stroke: Stroke) => void;
  /** The user's own letters drawn faintly underneath, to write a joined pair over. */
  ghost?: Contour[];
  label: string;
  describedBy?: string;
};

const DRY_MS = 600;

function ringPath(points: number[][]) {
  const path = new Path2D();
  points.forEach(([x, y], i) => (i ? path.lineTo(x!, y!) : path.moveTo(x!, y!)));
  path.closePath();
  return path;
}

function contourPath(contours: Contour[]) {
  const path = new Path2D();
  for (const c of contours) {
    if (!c.length) continue;
    path.moveTo(...c[0]![0]);
    for (const [, c1, c2, p] of c) path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
    path.closePath();
  }
  return path;
}

/**
 * The writing pad: live ink on a canvas, in font units, rendered with the same outline code as the
 * font so what you see is what you get. A finished stroke starts wet (blue-black) and dries to ink.
 */
export function Pad({ box = LETTER_BOX, strokes, pen, weight, ignoreTouch, onPen, onStroke, ghost, label, describedBy }: PadProps) {
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<LiveStroke | null>(null);
  const wetSince = useRef(new WeakMap<Stroke, number>());
  const paths = useRef(new WeakMap<Stroke, { key: string; path: Path2D }>());
  const frame = useRef(0);
  const redraw = useRef(() => {});
  const colours = useInkColours(surface);

  const draw = useCallback(() => {
    frame.current = 0;
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const c = colours.current ?? inkColours(cv);
    const scale = cv.width / (box.x1 - box.x0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, -scale, -box.x0 * scale, box.y1 * scale);

    if (ghost?.length) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = c.guide;
      ctx.fill(contourPath(ghost));
      ctx.globalAlpha = 1;
    }

    const now = performance.now();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let drying = false;
    for (const s of strokes) {
      const key = `${pen}:${weight}`;
      let cached = paths.current.get(s);
      if (cached?.key !== key) paths.current.set(s, (cached = { key, path: ringPath(strokeOutline(s, PENS[pen], weight)) }));
      const since = wetSince.current.get(s);
      const t = since === undefined || reduced ? 1 : Math.min(1, (now - since) / DRY_MS);
      if (t < 1) drying = true;
      ctx.fillStyle = t >= 1 ? c.ink : mix(c.wet, c.ink, t * t * (3 - 2 * t));
      ctx.fill(cached.path);
    }

    const l = live.current;
    if (l && l.points.length) {
      const pts: number[][] = [];
      const all = [...l.points, ...l.predicted];
      for (let i = 0; i < all.length; i += 4) pts.push([all[i]!, all[i + 1]!, all[i + 2]!]);
      const probe: Stroke = { points: Float32Array.from(l.points), pointerType: l.pointerType };
      const outline = getStroke(pts, {
        size: PENS[pen].size * weight,
        thinning: PENS[pen].thinning,
        smoothing: 0.5,
        streamline: 0.35,
        simulatePressure: !usesRealPressure(probe),
        last: false,
      });
      ctx.fillStyle = c.wet;
      ctx.fill(ringPath(outline));
    }
    if (drying) frame.current = requestAnimationFrame(() => redraw.current());
  }, [box, strokes, pen, weight, ghost, colours]);

  useEffect(() => {
    redraw.current = draw;
  }, [draw]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  useLayoutEffect(() => {
    const el = surface.current, cv = canvas.current;
    if (!el || !cv) return;
    const fit = () => {
      const rect = el.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
      draw();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    schedule();
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule]);

  usePointerInk(surface, {
    box,
    ignoreTouch,
    onPen,
    onLive: (s) => {
      live.current = s;
      schedule();
    },
    onStroke: (s) => {
      wetSince.current.set(s, performance.now());
      onStroke(s);
    },
  });

  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  return (
    <div
      ref={surface}
      className="pad"
      style={{ '--pad-aspect': aspect(box) } as CSSProperties}
      role="img"
      aria-label={label}
      aria-describedby={describedBy}
      data-strokes={strokes.length}
    >
      <svg className="pad__guides" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        {GUIDE_LINES.map((g) => (
          <line key={g.kind} className={`pad__guide pad__guide--${g.kind}`} x1={0} x2={w} y1={box.y1 - g.y} y2={box.y1 - g.y} />
        ))}
      </svg>
      <canvas ref={canvas} className="pad__ink" />
    </div>
  );
}
