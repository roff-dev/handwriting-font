import { useRef, useState } from 'react';
import type { Point } from '../../core/geometry';
import type { PaperSize } from '../../core/template/layout';

const CORNER_NAMES = ['top left', 'top right', 'bottom right', 'bottom left'];
const NUDGE = 0.01;

type Props = {
  preview: string;
  photoSize: { width: number; height: number };
  onRead: (size: PaperSize, page: number, corners: Point[]) => void;
  onCancel: () => void;
};

/**
 * Four handles to drag onto the paper's corners when the markers can't be found. Handles are also buttons
 * that move with the arrow keys, so the step works without a pointer.
 */
export function CornerEditor({ preview, photoSize, onRead, onCancel }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<Point[]>([[0.12, 0.1], [0.88, 0.1], [0.88, 0.9], [0.12, 0.9]]);
  const [size, setSize] = useState<PaperSize>('a4');
  const [page, setPage] = useState(0);
  const dragging = useRef<number | null>(null);

  const move = (i: number, p: Point) =>
    setCorners((cs) => cs.map((c, k): Point => (k === i ? [Math.min(1, Math.max(0, p[0])), Math.min(1, Math.max(0, p[1]))] : c)));

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current === null || !frame.current) return;
    const r = frame.current.getBoundingClientRect();
    move(dragging.current, [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
  };

  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? NUDGE * 5 : NUDGE;
    const d: Record<string, Point> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    move(i, [corners[i]![0] + delta[0], corners[i]![1] + delta[1]]);
  };

  return (
    <div className="corners">
      <p className="paper__lead">Drag each circle onto a corner of the paper, then tell us which page it is.</p>
      <div
        className="corners__frame"
        ref={frame}
        style={{ aspectRatio: `${photoSize.width} / ${photoSize.height}` }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <img src={preview} alt="Your photo of the template" draggable={false} />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={corners.map((c) => c.join(',')).join(' ')} />
        </svg>
        {corners.map(([x, y], i) => (
          <button
            key={i}
            type="button"
            className="corners__handle"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            aria-label={`Paper's ${CORNER_NAMES[i]} corner. Use the arrow keys to move it.`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragging.current = i;
            }}
            onKeyDown={onKey(i)}
          />
        ))}
      </div>
      <div className="corners__choices">
        <fieldset>
          <legend>Page</legend>
          {[0, 1, 2].map((p) => (
            <label key={p}>
              <input type="radio" name="page" checked={page === p} onChange={() => setPage(p)} />
              {p + 1}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Paper</legend>
          {(['a4', 'letter'] as const).map((s) => (
            <label key={s}>
              <input type="radio" name="paper" checked={size === s} onChange={() => setSize(s)} />
              {s === 'a4' ? 'A4' : 'US Letter'}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="paper__actions">
        <button type="button" className="button button--primary" onClick={() => onRead(size, page, corners.map(([x, y]): Point => [x * photoSize.width, y * photoSize.height]))}>
          Read this page
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Try another photo
        </button>
      </div>
    </div>
  );
}
