import { useEffect, useRef } from 'react';
import type { PointerKind, Stroke } from '../../core/ink/strokes';
import { toFontUnits, type PadBox } from './geometry';

export type LiveStroke = { points: number[]; predicted: number[]; pointerType: PointerKind };

type Options = {
  box: PadBox;
  /** Ignore finger input, once a pen has been seen (palm rejection). */
  ignoreTouch: boolean;
  onPen?: () => void;
  onLive: (stroke: LiveStroke | null) => void;
  onStroke: (stroke: Stroke) => void;
};

const kindOf = (t: string): PointerKind => (t === 'pen' || t === 'touch' ? t : 'mouse');

/**
 * Pointer handling for the pad. Positions come from coalesced events where the browser has them (every
 * sample the hardware produced, not one per frame); identity comes from the parent event, because Safari
 * 18.2's coalesced events lack pointerId. Predicted events only lengthen the live tail and are never kept.
 */
export function usePointerInk(target: React.RefObject<HTMLElement | null>, options: Options) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let active: { id: number; rect: DOMRect; t0: number; live: LiveStroke } | null = null;

    const sample = (e: PointerEvent, rect: DOMRect, t0: number, into: number[]) => {
      const [x, y] = toFontUnits(opts.current.box, rect.width, e.clientX - rect.left, e.clientY - rect.top);
      const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
      into.push(x, y, pressure, e.timeStamp - t0);
    };

    const down = (e: PointerEvent) => {
      if (active || e.button > 0) return;
      if (e.pointerType === 'pen') opts.current.onPen?.();
      else if (e.pointerType === 'touch' && opts.current.ignoreTouch) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture fails for pointers the browser isn't tracking; the stroke still works without it.
      }
      const rect = el.getBoundingClientRect();
      active = { id: e.pointerId, rect, t0: e.timeStamp, live: { points: [], predicted: [], pointerType: kindOf(e.pointerType) } };
      sample(e, rect, e.timeStamp, active.live.points);
      opts.current.onLive(active.live);
    };

    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const events = e.getCoalescedEvents?.() ?? [];
      for (const c of events.length ? events : [e]) sample(c, active.rect, active.t0, active.live.points);
      active.live.predicted = [];
      for (const p of e.getPredictedEvents?.() ?? []) sample(p, active.rect, active.t0, active.live.predicted);
      opts.current.onLive(active.live);
    };

    const up = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const { live } = active;
      active = null;
      opts.current.onLive(null);
      if (live.points.length) opts.current.onStroke({ points: Float32Array.from(live.points), pointerType: live.pointerType });
    };

    // A cancelled pointer (the system took over the gesture) leaves nothing behind.
    const cancel = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      active = null;
      opts.current.onLive(null);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, [target]);
}
