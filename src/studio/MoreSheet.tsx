import { animate } from 'motion';
import { useEffect, useRef, useState } from 'react';
import { LOWERCASE, MAX_PAIRS, UPPERCASE, type SetId } from '../core/project/sets';
import { useTheme, type ThemeChoice } from '../ui/theme';
import { useStudio } from './store';

const OPTIONAL: { id: SetId; title: string; detail: string }[] = [
  { id: 'extras', title: 'Extra symbols', detail: '# $ % * + = < > [ ] _ ~ ` ^ { } | \\ £ €' },
  { id: 'accents', title: 'Accents', detail: 'Draw 7 marks and get 54 accented letters, like é, ñ and ü.' },
  { id: 'variants', title: 'Second and third versions', detail: 'Draw your twelve busiest letters twice more and they take turns, so repeated letters never look stamped.' },
  { id: 'pairs', title: 'Joined pairs', detail: 'Write letter pairs like th joined, the way you really write them, and they replace the separate letters.' },
];

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const project = useStudio((s) => s.project);
  const setSettings = useStudio((s) => s.setSettings);
  const addPair = useStudio((s) => s.addPair);
  const setTab = useStudio((s) => s.setTab);
  const [first, setFirst] = useState('t');
  const [second, setSecond] = useState('h');
  const [pairError, setPairError] = useState('');
  const [theme, setTheme] = useTheme();

  // The sheet slides in on a spring and out with a quick ease, from the bottom on phones and the right on
  // wide screens; the dialog only closes once it's off screen. With reduced motion it fades.
  useEffect(() => {
    const d = dialog.current;
    if (!d || (!open && !d.open)) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const axis = matchMedia('(min-width: 700px)').matches ? 'x' : 'y';
    // Reopened mid-exit, it turns back from where it is; from closed, it starts off screen (as the CSS has it).
    const fresh = !d.open;
    if (open && fresh) {
      // The page's scrollbar width, taken before the open sheet locks the page (studio.css), which pads for it.
      document.documentElement.style.setProperty('--scrollbar', `${innerWidth - document.documentElement.clientWidth}px`);
      d.showModal();
    }
    const panel = reduced
      ? animate(d, { [axis]: '0%', opacity: open ? [fresh ? 0 : null, 1] : 0 }, { duration: 0.15, [axis]: { duration: 0 } })
      : open
        ? animate(d, { [axis]: fresh ? ['100%', '0%'] : '0%', opacity: 1 }, { type: 'spring', stiffness: 380, damping: 36 })
        : animate(d, { [axis]: '100%' }, { duration: 0.24, ease: [0.4, 0, 1, 1] });
    const shade = d.animate({ opacity: open ? [0, 1] : [1, 0] }, { duration: reduced ? 150 : open ? 300 : 240, pseudoElement: '::backdrop', fill: 'forwards' });
    let cancelled = false;
    if (!open) panel.then(() => !cancelled && d.close());
    return () => {
      cancelled = true;
      panel.stop();
      shade.cancel();
    };
  }, [open]);

  const sets = project.settings.sets;
  const toggle = (id: SetId, on: boolean) => setSettings({ sets: on ? [...sets, id] : sets.filter((s) => s !== id) });

  const add = () => {
    const missing = [first, second].filter((ch) => !project.glyphs[ch]?.[0]);
    if (missing.length) return setPairError(`Draw ${[...new Set(missing)].join(' and ')} first.`);
    if (Object.keys(project.pairs).length >= MAX_PAIRS) return setPairError(`That's the most pairs a font can hold here (${MAX_PAIRS}).`);
    setPairError('');
    addPair(first + second);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="more-title"
      onClose={onClose}
      onCancel={(e) => {
        // Escape closes through the same exit animation as Done and the backdrop.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="sheet__body">
        <div className="sheet__head">
          <h2 id="more-title">More characters</h2>
          <button type="button" className="button button--quiet" onClick={onClose}>
            Done
          </button>
        </div>

        <ul className="sheet__options">
          {OPTIONAL.map((o) => (
            <li key={o.id}>
              <label className="option">
                <input type="checkbox" checked={sets.includes(o.id)} onChange={(e) => toggle(o.id, e.target.checked)} />
                <span>
                  <span className="option__title">{o.title}</span>
                  <span className="option__detail">{o.detail}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <fieldset className="sheet__pair">
          <legend>Add your own pair</legend>
          <div className="sheet__pair-row">
            <label className="sheet__select">
              <span className="visually-hidden">First letter</span>
              <select value={first} onChange={(e) => setFirst(e.target.value)}>
                {[...LOWERCASE, ...UPPERCASE].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="sheet__select">
              <span className="visually-hidden">Second letter</span>
              <select value={second} onChange={(e) => setSecond(e.target.value)}>
                {LOWERCASE.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <button type="button" className="button" onClick={add} aria-describedby="pair-error">
              Add {first + second}
            </button>
          </div>
          <p className="sheet__error" id="pair-error" aria-live="polite">{pairError}</p>
          <p className="sheet__note">Doubled letters work well too: ll, ss, ee, oo, tt.</p>
        </fieldset>

        <div className="sheet__paper">
          <p className="option__title">Prefer paper?</p>
          <p className="option__detail">Print a template, fill it in with a pen and take a photo of each page.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setTab('paper');
              onClose();
            }}
          >
            Import from paper
          </button>
        </div>

        <nav className="sheet__links" aria-label="About this site">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href={import.meta.env.VITE_PORTFOLIO_URL}>Built by Kieron</a>
        </nav>

        <fieldset className="sheet__theme">
          <legend>Appearance</legend>
          {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
            <label key={t}>
              <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => setTheme(t)} />
              {t === 'system' ? 'Match this device' : t === 'light' ? 'Paper' : 'Night desk'}
            </label>
          ))}
        </fieldset>
      </div>
    </dialog>
  );
}
