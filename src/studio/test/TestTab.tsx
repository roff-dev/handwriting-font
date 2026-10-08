import { useId, useState } from 'react';
import { WEIGHT_RANGE, type PenId } from '../../core/ink/strokes';
import { SPACING_RANGE } from '../../core/metrics/spacing';
import { fontWorker, useLiveFont } from '../font';
import { useStudio } from '../store';
import { Preview, type PreviewFeatures } from './Preview';
import { savePng, saveSvg } from './saveImage';
import './test.css';

export const SAMPLE = 'The quick brown fox jumps over the lazy dog.';

const PENS: { id: PenId; label: string }[] = [
  { id: 'fineliner', label: 'Fineliner' },
  { id: 'felt', label: 'Felt tip' },
  { id: 'ink', label: 'Ink' },
];
const INKS = [
  { id: 'ink', label: 'Ink', value: '#1a1917' },
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'red', label: 'Red', value: '#b3341c' },
] as const;

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = useId();
  return (
    <div className="control">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{format(value)}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function TestTab() {
  const project = useStudio((s) => s.project);
  const setSettings = useStudio((s) => s.setSettings);
  const setTab = useStudio((s) => s.setTab);
  const { family, failed, chars } = useLiveFont();
  const [text, setText] = useState(SAMPLE);
  const [size, setSize] = useState(56);
  const [features, setFeatures] = useState<PreviewFeatures>({ variants: true, pairs: true, kerning: true });
  const [ink, setInk] = useState<(typeof INKS)[number]['id']>('ink');
  const [imageNote, setImageNote] = useState('');
  const settings = project.settings;
  const drawnAny = Object.keys(project.glyphs).length > 0;

  const save = async (kind: 'png' | 'svg') => {
    if (![...text].some((ch) => chars.has(ch))) return setImageNote('None of these letters are drawn yet.');
    setImageNote('');
    const image = await fontWorker().textImage(text, { liga: features.pairs, calt: features.variants, kern: features.kerning });
    const colour = INKS.find((i) => i.id === ink)!.value;
    await (kind === 'png' ? savePng(image, colour, text) : saveSvg(image, colour, text));
  };

  if (!drawnAny) {
    return (
      <div className="test test--empty">
        <p className="test__empty">Draw a few letters and they'll appear here.</p>
        <button type="button" className="button button--primary" onClick={() => setTab('write')}>
          Start writing
        </button>
      </div>
    );
  }

  return (
    <div className="test">
      <div className="test__stage">
        <label className="test__label" htmlFor="tester-text">
          Type anything
        </label>
        <textarea id="tester-text" className="test__input" value={text} rows={2} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        {!family && <p className="test__status">Building your font…</p>}
        {failed && family && <p className="test__status">Couldn't update your font just now, so this is the last version that built.</p>}
        <Preview text={text} size={size} features={features} className="test__preview" />
        {features.variants && (
          <div className="test__compare">
            <p className="test__label">Without variants</p>
            <Preview text={text} size={size} features={{ ...features, variants: false }} />
          </div>
        )}
      </div>

      <div className="test__rail">
        <Slider label="Size" value={size} min={16} max={160} step={1} onChange={setSize} format={(v) => `${v} px`} />

        <fieldset className="control control--choice">
          <legend>Pen</legend>
          {PENS.map((p) => (
            <label key={p.id}>
              <input type="radio" name="pen" checked={settings.pen === p.id} onChange={() => setSettings({ pen: p.id })} />
              {p.label}
            </label>
          ))}
        </fieldset>

        <Slider label="Weight" value={settings.weight} {...WEIGHT_RANGE} onChange={(weight) => setSettings({ weight })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Spacing" value={settings.spacing} {...SPACING_RANGE} onChange={(spacing) => setSettings({ spacing })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Tidy heights" value={settings.tidy} min={0} max={1} step={0.05} onChange={(tidy) => setSettings({ tidy })} format={(v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`)} />

        <fieldset className="control control--toggles">
          <legend>Show</legend>
          {(
            [
              ['variants', 'Variants taking turns'],
              ['pairs', 'Joined pairs'],
              ['kerning', 'Kerning'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" checked={features[key]} onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="control control--image">
          <legend>Save this text as an image</legend>
          <p className="control__note">For places that can't use a font, like Google Docs, messages or a cutting machine.</p>
          <div className="swatches">
            {INKS.map((i) => (
              <label key={i.id} className="swatch" style={{ '--swatch': i.value } as React.CSSProperties}>
                <input type="radio" name="ink" checked={ink === i.id} onChange={() => setInk(i.id)} />
                <span>{i.label}</span>
              </label>
            ))}
          </div>
          <div className="control__buttons">
            <button type="button" className="button" disabled={!family || !text.trim()} onClick={() => save('png')}>
              Save PNG
            </button>
            <button type="button" className="button" disabled={!family || !text.trim()} onClick={() => save('svg')}>
              Save SVG
            </button>
          </div>
          <p className="control__error" aria-live="polite">{imageNote}</p>
        </fieldset>
      </div>
    </div>
  );
}
