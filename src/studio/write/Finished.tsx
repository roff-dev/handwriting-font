import { characters } from '../../core/project/sets';
import { Specimen, useSpecimen } from '../export/Specimen';
import { useStudio } from '../store';

/** Shown instead of the pad once everything in the chosen sets is drawn. */
export function Finished() {
  const project = useStudio((s) => s.project);
  const setTab = useStudio((s) => s.setTab);
  const setMoreOpen = useStudio((s) => s.setMoreOpen);
  const specimen = useSpecimen();
  const count = characters(project.settings.sets).length;
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
      {specimen && (
        <div className="write__specimen">
          <Specimen data={specimen} />
        </div>
      )}
    </section>
  );
}
