import { animate } from 'motion';
import { useEffect, useRef } from 'react';
import { postScriptName } from '../../core/font/names';
import { characters } from '../../core/project/sets';
import { Specimen, specimenPng, useSpecimen } from '../export/Specimen';
import { useStudio } from '../store';
import { deliver } from '../test/saveImage';

/** The commit whose poster has already been revealed, so coming back to the tab doesn't replay it. */
let revealedFor = 0;
const FRESH_MS = 4000;

/**
 * Shown instead of the pad once everything in the chosen sets is drawn. Finishing on the pad brings the
 * specimen poster in like a sheet laid on the desk; it's also the image to share.
 */
export function Finished() {
  const project = useStudio((s) => s.project);
  const committed = useStudio((s) => s.committed);
  const setTab = useStudio((s) => s.setTab);
  const setMoreOpen = useStudio((s) => s.setMoreOpen);
  const setSettings = useStudio((s) => s.setSettings);
  const specimen = useSpecimen();
  const poster = useRef<HTMLDivElement>(null);
  const { sets } = project.settings;
  const count = characters(sets).length;
  const hasPoster = Boolean(specimen);

  // Only when the poster appears because the last character was just written, not on every visit.
  useEffect(() => {
    const el = poster.current;
    if (!el || !hasPoster || !committed || committed.at === revealedFor || Date.now() - committed.at > FRESH_MS) return;
    revealedFor = committed.at;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const a = reduced
      ? animate(el, { opacity: [0, 1] }, { duration: 0.15 })
      : animate(el, { opacity: [0, 1], y: [48, 0], rotate: [-3, 0] }, { type: 'spring', stiffness: 260, damping: 26 });
    return () => a.stop();
  }, [hasPoster, committed]);

  const add = (set: 'variants' | 'pairs') => setSettings({ sets: [...sets, set] });

  return (
    <section className="write__finished" aria-labelledby="finished-title">
      <h2 className="write__title" id="finished-title">
        Your font is ready.
      </h2>
      <p className="write__hint">All {count} characters are drawn. Tap any letter in the grid to redraw it.</p>
      <div className="write__choices">
        <button type="button" className="button button--primary" onClick={() => setTab('test')}>
          Test it
        </button>
        <button type="button" className="button" onClick={() => setTab('export')}>
          Export
        </button>
        <button type="button" className="button" onClick={() => setMoreOpen(true)}>
          Add more characters
        </button>
      </div>

      {!sets.includes('variants') ? (
        <div className="write__next-step">
          <p>Want it to look properly handwritten? Draw your twelve busiest letters twice more and they'll take turns, so repeated letters never look stamped.</p>
          <button type="button" className="button" onClick={() => add('variants')}>
            Draw them twice more
          </button>
        </div>
      ) : (
        !sets.includes('pairs') && (
          <div className="write__next-step">
            <p>Join the letters you join. Write pairs like th and er in one go, and they'll replace the separate letters wherever they appear.</p>
            <button type="button" className="button" onClick={() => add('pairs')}>
              Write joined pairs
            </button>
          </div>
        )
      )}

      {specimen && (
        <div className="write__specimen" ref={poster}>
          <Specimen data={specimen} />
          <button type="button" className="button" onClick={async () => deliver(await specimenPng(specimen), `${postScriptName(project.name)}-specimen.png`)}>
            Share specimen
          </button>
        </div>
      )}
    </section>
  );
}
