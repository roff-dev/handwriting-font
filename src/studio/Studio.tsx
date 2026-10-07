import { useEffect, useRef, useState } from 'react';
import { characters } from '../core/project/sets';
import '../ui/button.css';
import { startEngine } from './engine';
import { MoreSheet } from './MoreSheet';
import { restore, startAutosave } from './persistence';
import { useStudio, type Tab } from './store';
import { WriteTab } from './write/WriteTab';
import './studio.css';

const TABS: { id: Tab; label: string }[] = [
  { id: 'write', label: 'Write' },
  { id: 'test', label: 'Test' },
  { id: 'export', label: 'Export' },
];

function Tabs({ placement }: { placement: 'top' | 'bottom' }) {
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  return (
    <div className={`studio__tabs studio__tabs--${placement}`} role="tablist" aria-label="Studio">
      {TABS.map((t) => (
        <button key={t.id} type="button" role="tab" id={`tab-${t.id}-${placement}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Studio() {
  const project = useStudio((s) => s.project);
  const tab = useStudio((s) => s.tab);
  const storage = useStudio((s) => s.storage);
  const [toast, setToast] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    restore().then((r) => {
      if (r && r.drawn) setToast(`Welcome back. ${r.drawn} of ${r.total} drawn.`);
      startAutosave();
      startEngine();
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const chars = characters(project.settings.sets);
  const drawn = chars.filter((ch) => project.glyphs[ch]?.[0]).length;

  return (
    <div className="studio">
      <header className="studio__bar">
        <a className="studio__home" href="/">
          <span className="visually-hidden">Handwriting Font Maker, home. Project: </span>
          {project.name}
        </a>
        <Tabs placement="top" />
        <p className="studio__progress" aria-label={`${drawn} of ${chars.length} characters drawn`}>
          {drawn} of {chars.length}
        </p>
        <button type="button" className="button button--quiet studio__more" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          More
        </button>
      </header>

      {storage === 'unavailable' && (
        <p className="studio__banner" role="alert">
          This browser won't keep your work if you close the tab. Save a project file before you leave.
        </p>
      )}

      <main className="studio__main" id="main">
        <h1 className="visually-hidden">Studio</h1>
        <section id="panel-write" role="tabpanel" aria-label="Write" hidden={tab !== 'write'}>
          {tab === 'write' && <WriteTab />}
        </section>
        <section id="panel-test" role="tabpanel" aria-label="Test" hidden={tab !== 'test'} />
        <section id="panel-export" role="tabpanel" aria-label="Export" hidden={tab !== 'export'} />
      </main>

      <Tabs placement="bottom" />

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      <div className="studio__toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
