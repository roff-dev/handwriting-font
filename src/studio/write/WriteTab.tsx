import { useEffect, useMemo, useRef, useState } from 'react';
import { bounds, mapContours, type Contour } from '../../core/geometry';
import { LOWERCASE } from '../../core/project/sets';
import { Pad } from '../../ui/pad/Pad';
import { LETTER_BOX, PAIR_BOX } from '../../ui/pad/geometry';
import { describe, prompt, slotKey } from '../slots';
import { useStudio } from '../store';
import { Flight } from './Flight';
import { GlyphGrid } from './GlyphGrid';
import './write.css';

/** The user's own two letters, side by side at roughly their spaced positions, to write a pair over. */
function pairGhost(first?: Contour[], second?: Contour[]): Contour[] | undefined {
  if (!first?.length || !second?.length) return undefined;
  const a = bounds(first), b = bounds(second);
  const gap = 70, start = 120;
  return [
    ...mapContours(first, ([x, y]) => [x - a.x0 + start, y]),
    ...mapContours(second, ([x, y]) => [x - b.x0 + start + (a.x1 - a.x0) + gap, y]),
  ];
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function WriteTab() {
  const s = useStudio();
  const { cursor, draft, project, outlines } = s;
  const pad = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(false);
  const p = prompt(cursor);
  const settings = project.settings;

  const ghost = useMemo(
    () => (cursor.kind === 'pair' ? pairGhost(outlines[slotKey({ kind: 'glyph', ch: cursor.pair[0]!, version: 0 })], outlines[slotKey({ kind: 'glyph', ch: cursor.pair[1]!, version: 0 })]) : undefined),
    [cursor, outlines],
  );

  const alphabetDone = LOWERCASE.every((ch) => project.glyphs[ch]?.[0]);
  // Celebrates the commit that finishes the alphabet; it doesn't come back after a reload.
  const justFinished = s.committed?.slot.kind === 'glyph' && LOWERCASE.includes(s.committed.slot.ch);
  const showAlphabetNotice = alphabetDone && justFinished && !s.alphabetNoticeSeen && cursor.kind === 'glyph' && cursor.ch === 'A' && cursor.version === 0 && !draft.length;

  const next = () => {
    if (!draft.length) {
      setHint(true);
      return;
    }
    setHint(false);
    navigator.vibrate?.(8);
    s.commit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStudio.getState().redo();
        else useStudio.getState().undo();
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (useStudio.getState().draft.length) useStudio.getState().commit();
        else setHint(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const label = cursor.kind === 'pair' ? `Drawing area for ${cursor.pair} joined` : `Drawing area for ${describe(cursor.ch)}${cursor.version ? `, version ${cursor.version + 1}` : ''}`;

  return (
    <div className={`write${cursor.kind === 'pair' ? ' write--wide' : ''}`}>
        {showAlphabetNotice ? (
          <div className="write__prompt" role="status">
            <p className="write__title">That's the alphabet.</p>
            <p className="write__hint">Capitals next, or try your font out now.</p>
            <div className="write__choices">
              <button type="button" className="button button--primary" onClick={s.dismissAlphabetNotice}>
                Carry on with capitals
              </button>
              <button type="button" className="button" onClick={() => s.setTab('test')}>
                Try it out
              </button>
            </div>
          </div>
        ) : (
          <div className="write__prompt">
            <p className="write__title" id="prompt">{p.title}</p>
            {p.hint && <p className="write__hint" id="prompt-hint">{p.hint}</p>}
          </div>
        )}

        <div className="write__pad" ref={pad}>
          <Pad
            box={cursor.kind === 'pair' ? PAIR_BOX : LETTER_BOX}
            strokes={draft}
            pen={settings.pen}
            weight={settings.weight}
            ignoreTouch={!s.fingerAllowed}
            onPen={s.penDetected}
            onStroke={(stroke) => {
              setHint(false);
              s.addStroke(stroke);
            }}
            ghost={ghost}
            label={label}
            describedBy={p.hint ? 'prompt prompt-hint' : 'prompt'}
          />
        </div>

        <div className="write__actions">
          <button type="button" className="button button--quiet" onClick={s.undo} disabled={!s.past.length} aria-keyshortcuts="Control+Z Meta+Z">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5 3.5 9.5 8 14M4 9.5h7.5a4.5 4.5 0 0 1 0 9H10" /></svg>
            Undo
          </button>
          <button type="button" className="button button--quiet" onClick={s.clear} disabled={!draft.length}>
            Clear
          </button>
          <button type="button" className="button button--quiet write__skip" onClick={s.skip}>
            Skip
          </button>
          <button type="button" className="button button--primary write__next" aria-disabled={!draft.length} onClick={next}>
            Next
          </button>
        </div>
        <p className="write__nudge" aria-live="polite">{hint ? 'Draw something first, or skip.' : ''}</p>

        {s.penSeen && (
          <label className="write__finger">
            <input type="checkbox" checked={s.fingerAllowed} onChange={(e) => s.allowFinger(e.target.checked)} />
            Drawing with your finger?
          </label>
        )}

      <div className="write__grid">
        <GlyphGrid />
      </div>

      <Flight pad={pad} />
    </div>
  );
}
