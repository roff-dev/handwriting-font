import { animate } from 'motion';
import { useEffect } from 'react';
import { PENS, strokeOutline } from '../../core/ink/strokes';
import { ringPathData } from '../../ui/glyphPath';
import { LETTER_BOX, PAIR_BOX } from '../../ui/pad/geometry';
import { slotKey } from '../slots';
import { useStudio } from '../store';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The glyph you just wrote lifts off the pad and springs into its cell in the grid, so you see where it
 * went and that it's kept. A copy of the ink is animated with a transform, so nothing reflows, and the
 * cell stays empty until it lands.
 */
export function Flight({ pad }: { pad: React.RefObject<HTMLElement | null> }) {
  const committed = useStudio((s) => s.committed);

  useEffect(() => {
    if (!committed) return;
    const from = pad.current?.getBoundingClientRect();
    const cell = document.querySelector(`[data-slot="${CSS.escape(slotKey(committed.slot))}"]`);
    if (!from || !cell) return;
    const { pen, weight } = useStudio.getState().project.settings;
    const box = committed.slot.kind === 'pair' ? PAIR_BOX : LETTER_BOX;
    const to = cell.getBoundingClientRect();

    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'flight');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `${box.x0} ${-box.y1} ${box.x1 - box.x0} ${box.y1 - box.y0}`);
    Object.assign(svg.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('transform', 'scale(1 -1)');
    path.setAttribute('d', ringPathData(committed.strokes.map((s) => strokeOutline(s, PENS[pen], weight))));
    svg.append(path);
    document.body.append(svg);
    cell.setAttribute('data-landing', '');

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flight = reduced
      ? animate(svg, { opacity: [1, 0] }, { duration: 0.15 })
      : animate(svg, { x: [0, to.left - from.left], y: [0, to.top - from.top], scale: [1, to.width / from.width] }, { type: 'spring', stiffness: 260, damping: 26 });
    const land = () => {
      cell.removeAttribute('data-landing');
      svg.remove();
    };
    flight.finished.then(land, land);
    return () => {
      flight.stop();
      land();
    };
  }, [committed, pad]);

  return null;
}
