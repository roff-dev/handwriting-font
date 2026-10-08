import { proxy, wrap, type Remote } from 'comlink';
import { useEffect, useRef, useState } from 'react';
import type { Contour, Point } from '../../core/geometry';
import type { BoxResult, Placement } from '../../core/photo/extract';
import type { Photo } from '../../core/photo/image';
import { COLS, PAPER, ROWS, templateFileName, type Cell, type PaperSize } from '../../core/template/layout';
import { holdBackdrop } from '../../ui/backdrop';
import { cellViewBox, contourPathData } from '../../ui/glyphPath';
import { LETTER_BOX } from '../../ui/pad/geometry';
import type { PhotoWorkerApi } from '../../workers/photo.worker';
import { describe, display } from '../slots';
import { useStudio } from '../store';
import { CornerEditor } from './CornerEditor';
import { decodePhoto, NotAPhotoError } from './decode';
import './paper.css';

type View =
  | { kind: 'start'; error?: string }
  | { kind: 'reading'; place: Placement | null; boxes: BoxResult[] }
  | { kind: 'corners' }
  | { kind: 'review'; place: Placement; boxes: BoxResult[]; use: Set<number> };

const TOTAL = COLS * ROWS;
const PAGE_NAMES = ['Lowercase, figures and punctuation', 'Capitals, symbols and accent marks', 'Second and third versions'];

let worker: Remote<PhotoWorkerApi> | undefined;
const photoWorker = () => (worker ??= wrap<PhotoWorkerApi>(new Worker(new URL('../../workers/photo.worker.ts', import.meta.url), { type: 'module', name: 'photo' })));

function BoxPreview({ cell, contours }: { cell: Cell; contours: Contour[] | null }) {
  const b = LETTER_BOX;
  return contours ? (
    <svg viewBox={cellViewBox(contours, b)} aria-hidden="true">
      <path transform="scale(1 -1)" d={contourPathData(contours)} />
    </svg>
  ) : (
    <span className="cell__type" aria-hidden="true">{display(cell.ch)}</span>
  );
}

/** Print the template, photograph a page, and its boxes become glyphs. */
export function PaperImport() {
  const project = useStudio((s) => s.project);
  const setTab = useStudio((s) => s.setTab);
  const addPhotoGlyphs = useStudio((s) => s.addPhotoGlyphs);
  const [view, setView] = useState<View>({ kind: 'start' });
  const [photo, setPhoto] = useState<{ size: { width: number; height: number }; preview: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => () => {
    if (photo?.preview) URL.revokeObjectURL(photo.preview);
  }, [photo]);

  const drawn = (c: Cell) => Boolean(project.glyphs[c.ch]?.[c.version]);

  const read = (place: Placement) => holdBackdrop(async () => {
    setView({ kind: 'reading', place, boxes: [] });
    const boxes = await photoWorker().read(place, proxy((box: BoxResult) => setView((v) => (v.kind === 'reading' ? { ...v, boxes: [...v.boxes, box] } : v))));
    if (boxes.every((b) => !b.contours)) {
      setView({ kind: 'start', error: 'The page looks too blurry or dark to read. Try again in brighter, even light, holding the phone steady.' });
      return;
    }
    // Boxes for characters already drawn on the pad start unticked, so a photo never quietly replaces them.
    setView({ kind: 'review', place, boxes, use: new Set(boxes.filter((b) => b.contours && !drawn(b.cell)).map((b) => b.index)) });
  });

  const choose = (file: File | undefined) => file && holdBackdrop(async () => {
    setView({ kind: 'reading', place: null, boxes: [] });
    let decoded: { photo: Photo; preview: string };
    try {
      decoded = await decodePhoto(file);
    } catch (e) {
      setView({ kind: 'start', error: e instanceof NotAPhotoError ? "That file couldn't be opened as a photo. Try a JPEG, PNG or HEIC." : String(e) });
      return;
    } finally {
      if (input.current) input.current.value = '';
    }
    setPhoto({ size: { width: decoded.photo.width, height: decoded.photo.height }, preview: decoded.preview });
    const found = await photoWorker().load(decoded.photo);
    if ('error' in found) {
      setView({ kind: 'start', error: "We couldn't see the corners. Get the whole page in the photo, hold the phone flat above it, and avoid strong shadows." });
      return;
    }
    await read(found);
  });

  const byCorners = async (size: PaperSize, page: number, corners: Point[]) => read(await photoWorker().byCorners(size, page, corners));

  const reading = view.kind === 'reading';
  return (
    <div className="paper">
      <div className="paper__head">
        <h2 className="paper__title">From paper</h2>
        <button type="button" className="button button--quiet" onClick={() => setTab('write')}>
          Back to writing
        </button>
      </div>

      {view.kind === 'start' && (
        <>
          <ol className="paper__steps">
            <li>
              <h3>Print the template</h3>
              <p>Three pages, one character per box. Print at 100%, not “fit to page”.</p>
              <div className="paper__actions">
                {(['a4', 'letter'] as const).map((s) => (
                  <a key={s} className="button" href={`/templates/${templateFileName(s)}`} download>
                    {PAPER[s].label} template
                  </a>
                ))}
              </div>
            </li>
            <li>
              <h3>Fill it in and take a photo of each page</h3>
              <p>Use a dark pen. Hold the phone flat above the page and keep all four corner squares in the picture.</p>
              <div
                className={`paper__drop${dragOver ? ' paper__drop--over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void choose(e.dataTransfer.files[0]);
                }}
              >
                <button type="button" className="button button--primary" onClick={() => input.current?.click()}>
                  Take or choose a photo
                </button>
                <span className="paper__drop-hint">or drop a photo here</span>
                <input ref={input} type="file" accept="image/*" hidden aria-label="Photo of a template page" onChange={(e) => void choose(e.target.files?.[0])} />
              </div>
            </li>
          </ol>
          {view.error && (
            <div className="paper__error" role="alert">
              <p>{view.error}</p>
              {photo && view.error.startsWith("We couldn't see") && (
                <button type="button" className="button" onClick={() => setView({ kind: 'corners' })}>
                  Mark the corners myself
                </button>
              )}
            </div>
          )}
        </>
      )}

      {view.kind === 'corners' && photo && <CornerEditor preview={photo.preview} photoSize={photo.size} onRead={byCorners} onCancel={() => setView({ kind: 'start' })} />}

      {(reading || view.kind === 'review') && (
        <section className="paper__result" aria-busy={reading}>
          <p className="paper__lead" role="status">
            {reading
              ? view.place
                ? `Reading the boxes: ${view.boxes.length} of ${TOTAL}`
                : 'Finding the page…'
              : `Page ${view.place.page + 1} of 3, ${PAPER[view.place.size].label}: ${PAGE_NAMES[view.place.page]}. Tap a box to leave it out; you can draw it on the pad instead.`}
          </p>
          <div className="paper__grid">
            {(view.kind === 'review' ? view.boxes : reading ? view.boxes : []).map((b) => {
              const used = view.kind === 'review' && view.use.has(b.index);
              const name = b.cell.version ? `${describe(b.cell.ch)}, version ${b.cell.version + 1}` : describe(b.cell.ch);
              return (
                <button
                  key={b.index}
                  type="button"
                  className="cell paper__cell"
                  data-drawn={Boolean(b.contours)}
                  aria-pressed={view.kind === 'review' && b.contours ? used : undefined}
                  disabled={!b.contours || view.kind !== 'review'}
                  aria-label={b.contours ? `${name}${used ? ', will be used' : ', left out'}${drawn(b.cell) ? ', already drawn on the pad' : ''}` : `${name}, empty`}
                  onClick={() => {
                    if (view.kind !== 'review') return;
                    const use = new Set(view.use);
                    if (use.has(b.index)) use.delete(b.index);
                    else use.add(b.index);
                    setView({ ...view, use });
                  }}
                >
                  <BoxPreview cell={b.cell} contours={b.contours} />
                </button>
              );
            })}
          </div>
          {view.kind === 'review' && (
            <div className="paper__actions">
              <button
                type="button"
                className="button button--primary"
                disabled={!view.use.size}
                onClick={() => addPhotoGlyphs(view.boxes.filter((b) => view.use.has(b.index) && b.contours).map((b) => ({ cell: b.cell, contours: b.contours! })))}
              >
                Add {view.use.size} {view.use.size === 1 ? 'character' : 'characters'}
              </button>
              <button type="button" className="button" onClick={() => setView({ kind: 'start' })}>
                Another page
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
