import { useEffect, useId, useRef, useState } from 'react';
import { MAX_DESIGNER, postScriptName, validateFamily } from '../../core/font/names';
import { deserialize, NotAProjectError } from '../../core/project/serialize';
import { MIN_TO_EXPORT } from '../../core/project/sets';
import type { Project } from '../../core/project/schema';
import { useLiveFont } from '../font';
import { useStudio } from '../store';
import { deliver } from '../test/saveImage';
import { download, makeFile, type FileKind } from './files';
import { detectPlatform, INSTALL, USE_IN, type Platform } from './guidance';
import { Specimen, specimenPng, useSpecimen } from './Specimen';
import './export.css';

type RowState = 'idle' | 'working' | 'done' | 'error';

function FileButton({ kind, label, disabled, primary }: { kind: FileKind; label: string; disabled: boolean; primary?: boolean }) {
  const [state, setState] = useState<RowState>('idle');
  useEffect(() => {
    if (state !== 'done') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const run = async () => {
    setState('working');
    try {
      const { blob, name } = await makeFile(kind);
      download(blob, name);
      setState('done');
    } catch {
      setState('error');
    }
  };
  return (
    <span className="file">
      <button type="button" className={`button${primary ? ' button--primary' : ''}`} disabled={disabled || state === 'working'} aria-busy={state === 'working'} onClick={run}>
        {state === 'working' ? <span className="spinner" aria-hidden="true" /> : state === 'done' ? <span aria-hidden="true">✓</span> : null}
        {label}
      </button>
      {state === 'error' && (
        <span className="file__error" role="alert">
          {kind === 'woff2' ? "The web font isn't available right now. The .woff works everywhere it's needed." : "That file couldn't be made. Try again in a moment."}
        </span>
      )}
    </span>
  );
}

function Field({ label, value, onChange, error, hint, maxLength }: { label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; maxLength?: number }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} maxLength={maxLength} autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={`${id}-note`} onChange={(e) => onChange(e.target.value)} />
      <p id={`${id}-note`} className={error ? 'field__error' : 'field__hint'}>{error ?? hint}</p>
    </div>
  );
}

const POSTER = { paper: '#fbf9f4', ink: '#1a1917', soft: '#57524a', accent: '#b3341c' };

export function ExportTab() {
  const project = useStudio((s) => s.project);
  const setNames = useStudio((s) => s.setNames);
  const replaceProject = useStudio((s) => s.replaceProject);
  const setTab = useStudio((s) => s.setTab);
  const building = useLiveFont((s) => s.building);
  const specimen = useSpecimen();
  const [name, setName] = useState(project.name);
  const [platform] = useState<Platform>(() => detectPlatform());
  const [openError, setOpenError] = useState('');
  const [incoming, setIncoming] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const confirm = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const nameError = validateFamily(name);
  const missing = MIN_TO_EXPORT.filter((ch) => !project.glyphs[ch]?.[0]);
  const blocked = missing.length > 0 || Boolean(nameError);
  const ps = postScriptName(project.name);
  const css = `@font-face {\n  font-family: "${project.name}";\n  src: url("${ps}.woff2") format("woff2"), url("${ps}.woff") format("woff");\n  font-display: swap;\n}`;

  useEffect(() => {
    if (incoming) confirm.current?.showModal();
  }, [incoming]);

  const onName = (v: string) => {
    setName(v);
    if (!validateFamily(v)) setNames({ name: v.trim().replace(/\s+/g, ' ') });
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    setOpenError('');
    try {
      setIncoming(deserialize(new Uint8Array(await file.arrayBuffer())));
    } catch (e) {
      setOpenError(e instanceof NotAProjectError ? e.message : "That file couldn't be opened.");
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const rows = [
    {
      id: 'computer',
      title: 'For your computer',
      note: '.otf for Mac and most apps, .ttf for Windows, Procreate and Android apps.',
      files: [
        { kind: 'otf' as const, label: 'Download .otf' },
        { kind: 'ttf' as const, label: 'Download .ttf' },
      ],
    },
    { id: 'iphone', title: 'For iPhone and iPad', note: 'Installs the font for every app with a font picker.', files: [{ kind: 'mobileconfig' as const, label: 'Install on iPhone' }] },
    {
      id: 'web',
      title: 'For websites',
      note: 'WOFF2 for modern browsers, WOFF for Canva and older site builders.',
      files: [
        { kind: 'woff2' as const, label: '.woff2' },
        { kind: 'woff' as const, label: '.woff' },
        { kind: 'css' as const, label: '.css' },
      ],
    },
    { id: 'all', title: 'Everything', note: 'Every file above in one zip, with install steps.', files: [{ kind: 'zip' as const, label: 'Download zip' }] },
  ];
  const ordered = platform === 'iphone' ? [rows[1]!, rows[0]!, rows[2]!, rows[3]!] : rows;
  const mine = platform === 'other' ? undefined : platform;
  const others = (Object.keys(INSTALL) as (keyof typeof INSTALL)[]).filter((p) => p !== mine);

  return (
    <div className="export">
      <div className="export__main">
        <section className="export__section" aria-labelledby="export-name">
          <h2 id="export-name" className="export__heading">Name your font</h2>
          <Field label="Font name" value={name} onChange={onName} error={nameError} hint={`Saved as ${ps}.`} maxLength={40} />
          <Field label="Designer (optional)" value={project.designer} onChange={(designer) => setNames({ designer })} hint="Written into the font as its designer." maxLength={MAX_DESIGNER} />
        </section>

        <section className="export__section" aria-labelledby="export-files">
          <h2 id="export-files" className="export__heading">Download</h2>
          {missing.length > 0 && (
            <div className="export__gate">
              <p>
                Draw a–z to export ({missing.length} to go).
              </p>
              <button type="button" className="button" onClick={() => setTab('write')}>
                Keep writing
              </button>
            </div>
          )}
          <ul className="rows">
            {ordered.map((row, i) => (
              <li key={row.id} className="row">
                <div>
                  <h3 className="row__title">{row.title}</h3>
                  <p className="row__note">{row.note}</p>
                </div>
                <div className="row__files">
                  {row.files.map((f) => (
                    <FileButton key={f.kind} kind={f.kind} label={f.label} disabled={blocked} primary={i === 0 && f === row.files[0]} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {building && <p className="export__status">Updating your font with the latest changes…</p>}
        </section>

        <section className="export__section" aria-labelledby="export-install">
          <h2 id="export-install" className="export__heading">Install</h2>
          {mine && (
            <div className="install install--mine">
              <h3>{INSTALL[mine].title}</h3>
              <p>{INSTALL[mine].steps}</p>
            </div>
          )}
          <details className="install__others" open={!mine}>
            <summary>Other devices</summary>
            {others.map((p) => (
              <div key={p} className="install">
                <h3>{INSTALL[p].title}</h3>
                <p>{INSTALL[p].steps}</p>
              </div>
            ))}
          </details>
        </section>

        <section className="export__section" aria-labelledby="export-use">
          <h2 id="export-use" className="export__heading">Use it in…</h2>
          <dl className="uses">
            {USE_IN.map((u) => (
              <div key={u.app} className="use">
                <dt>{u.app}</dt>
                <dd>
                  {u.how}
                  {u.app === 'Your website' && (
                    <span className="snippet">
                      <code>{css}</code>
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(css);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? 'Copied' : 'Copy CSS'}
                      </button>
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="export__section" aria-labelledby="export-project">
          <h2 id="export-project" className="export__heading">Your project</h2>
          <p className="export__note">Safari clears saved work after 7 days without a visit. Save a project file to keep it safe, and open it here to carry on, on any device.</p>
          <div className="row__files">
            <FileButton kind="project" label="Save project file" disabled={false} />
            <button type="button" className="button" onClick={() => fileInput.current?.click()}>
              Open a project file
            </button>
            <input ref={fileInput} type="file" accept=".hwfont" hidden onChange={(e) => open(e.target.files?.[0])} aria-label="Project file" />
          </div>
          <p className="field__error" role="alert">{openError}</p>
        </section>
      </div>

      <aside className="export__poster" aria-label="Specimen">
        {specimen ? (
          <>
            <Specimen data={specimen} />
            <button
              type="button"
              className="button"
              onClick={async () => deliver(await specimenPng(specimen, POSTER), `${ps}-specimen.png`)}
            >
              Share specimen
            </button>
          </>
        ) : (
          <p className="export__note">Your specimen appears here once a few letters are drawn.</p>
        )}
      </aside>

      <dialog ref={confirm} className="confirm" aria-labelledby="confirm-title" onClose={() => setIncoming(null)}>
        <h2 id="confirm-title">Open “{incoming?.name}”?</h2>
        <p>It replaces what's in the studio now. Save a project file first if you want to keep this one.</p>
        <div className="row__files">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              if (incoming) {
                replaceProject(incoming);
                setName(incoming.name);
              }
              confirm.current?.close();
            }}
          >
            Open it
          </button>
          <button type="button" className="button" onClick={() => confirm.current?.close()}>
            Cancel
          </button>
        </div>
      </dialog>
    </div>
  );
}
