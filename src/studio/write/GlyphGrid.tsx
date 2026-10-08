import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ACCENT_MARKS, DIGITS, EXTRAS, LOWERCASE, PUNCTUATION, UPPERCASE } from '../../core/project/sets';
import { cellViewBox, contourPathData } from '../../ui/glyphPath';
import { LETTER_BOX, PAIR_BOX } from '../../ui/pad/geometry';
import { describe, display, isDone, sameSlot, sequence, slotKey, type Slot } from '../slots';
import { useStudio } from '../store';
import './grid.css';

type Group = { title: string; slots: Slot[] };

/** The cell in the next or previous visual row that sits closest under or over cell `i`. */
function verticalNeighbour(cells: HTMLElement[], i: number, dir: 1 | -1): number | undefined {
  const from = cells[i]!.getBoundingClientRect(), cx = from.left + from.width / 2;
  let best: number | undefined, bestGap = Infinity, bestDx = Infinity;
  cells.forEach((cell, j) => {
    const b = cell.getBoundingClientRect();
    const gap = dir > 0 ? b.top - from.bottom : from.top - b.bottom;
    if (gap < -1) return;
    const dx = Math.abs(b.left + b.width / 2 - cx);
    if (gap < bestGap - 2 || (Math.abs(gap - bestGap) <= 2 && dx < bestDx)) [best, bestGap, bestDx] = [j, gap, dx];
  });
  return best;
}

function groups(slots: Slot[]): Group[] {
  const of = (title: string, test: (s: Slot) => boolean) => ({ title, slots: slots.filter(test) });
  const glyph = (chars: string[]) => (s: Slot) => s.kind === 'glyph' && s.version === 0 && chars.includes(s.ch);
  return [
    of('Lowercase', glyph(LOWERCASE)),
    of('Capitals', glyph(UPPERCASE)),
    of('Figures', glyph(DIGITS)),
    of('Punctuation', glyph(PUNCTUATION)),
    of('Extras', glyph(EXTRAS)),
    of('Accent marks', glyph(ACCENT_MARKS)),
    of('Second versions', (s) => s.kind === 'glyph' && s.version === 1),
    of('Third versions', (s) => s.kind === 'glyph' && s.version === 2),
    of('Joined pairs', (s) => s.kind === 'pair'),
  ].filter((g) => g.slots.length);
}

function label(slot: Slot, drawn: boolean, versions: number) {
  const name = slot.kind === 'pair' ? `${slot.pair} joined` : slot.version ? `${slot.ch}, version ${slot.version + 1}` : slot.ch;
  const detail = slot.kind === 'glyph' && slot.version === 0 && versions > 1 ? `, ${versions} versions` : '';
  return `${name}, ${drawn ? 'drawn' : 'not drawn'}${detail}`;
}

/**
 * The specimen grid of everything the font needs: drawn glyphs in the user's ink, the rest as faint type.
 * On phones it becomes one scrolling strip under the pad.
 */
export function GlyphGrid() {
  const project = useStudio((s) => s.project);
  const cursor = useStudio((s) => s.cursor);
  const finished = useStudio((s) => s.finished);
  const outlines = useStudio((s) => s.outlines);
  const select = useStudio((s) => s.select);
  const list = useRef<HTMLDivElement>(null);
  // One tab stop for the whole grid: the cell last focused while inside it, otherwise the current character.
  const [focused, setFocused] = useState<string | null>(null);
  const slots = sequence(project);
  const keys = slots.map(slotKey);
  const stop = focused && keys.includes(focused) ? focused : !finished && keys.includes(slotKey(cursor)) ? slotKey(cursor) : keys[0];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cells = [...e.currentTarget.querySelectorAll<HTMLElement>('.cell')];
    const i = cells.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: cells.length - 1 }[e.key] ?? (e.key === 'ArrowDown' ? verticalNeighbour(cells, i, 1) : e.key === 'ArrowUp' ? verticalNeighbour(cells, i, -1) : undefined);
    if (to === undefined || !cells[to]) return;
    e.preventDefault();
    cells[to].focus();
  };

  useEffect(() => {
    const cell = list.current?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slotKey(cursor))}"]`);
    cell?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [cursor]);

  return (
    <div
      className="grid"
      ref={list}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
      }}
    >
      {groups(slots).map((g) => (
        <section className="grid__group" key={g.title} aria-label={g.title}>
          <h2 className="grid__title">{g.title}</h2>
          <div className="grid__cells">
            {g.slots.map((slot) => {
              const key = slotKey(slot), drawn = isDone(project, slot), contours = outlines[key];
              const box = slot.kind === 'pair' ? PAIR_BOX : LETTER_BOX;
              const versions = slot.kind === 'glyph' ? project.glyphs[slot.ch]?.length ?? 0 : 0;
              const current = !finished && sameSlot(slot, cursor);
              return (
                <button
                  key={key}
                  type="button"
                  className={`cell${slot.kind === 'pair' ? ' cell--pair' : ''}`}
                  data-slot={key}
                  data-drawn={drawn}
                  aria-current={current ? 'step' : undefined}
                  aria-label={label(slot, drawn, versions)}
                  tabIndex={key === stop ? 0 : -1}
                  onFocus={() => setFocused(key)}
                  title={slot.kind === 'glyph' ? describe(slot.ch) : `${slot.pair}, joined`}
                  onClick={() => select(slot)}
                >
                  {drawn && contours ? (
                    <svg viewBox={cellViewBox(contours, box)} aria-hidden="true">
                      <path transform="scale(1 -1)" d={contourPathData(contours)} />
                    </svg>
                  ) : (
                    <span className="cell__type" aria-hidden="true">
                      {slot.kind === 'pair' ? slot.pair : display(slot.ch)}
                    </span>
                  )}
                  {slot.kind === 'glyph' && slot.version > 0 && <span className="cell__version" aria-hidden="true">{slot.version + 1}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
