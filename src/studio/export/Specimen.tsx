import { useLiveFont } from '../font';
import { useStudio } from '../store';
import './specimen.css';

export const SPECIMEN_SAMPLE = 'The quick brown fox jumps over the lazy dog.';
export const WATERFALL = [96, 48, 24, 14];
/** The poster is always printed on paper, whatever the studio's theme. */
export const POSTER_COLOURS = { paper: '#fbf9f4', ink: '#1a1917', soft: '#57524a', accent: '#b3341c' };
const DOUBLES = /(ss|pp)/g;

export type SpecimenData = { family: string; cssFamily: string; display: string; colophon: string; pairsLine: string | null };

const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** What the poster says, shared by the on-screen version and the PNG. */
export function useSpecimen(): SpecimenData | null {
  const project = useStudio((s) => s.project);
  const { family, chars, glyphCount, kerningPairs } = useLiveFont();
  if (!family) return null;
  const display = chars.has('A') && chars.has('a') ? 'Aa' : [...chars].filter((c) => /[A-Za-z]/.test(c)).slice(0, 2).join('') || 'Aa';
  const designer = project.designer.trim();
  const colophon = `${project.name} Regular${designer ? `, designed by ${designer}` : ''}. ${longDate(new Date())}. ${glyphCount.toLocaleString('en-GB')} glyphs, ${kerningPairs.toLocaleString('en-GB')} kerning pairs.`;
  return { family: project.name, cssFamily: family, display, colophon, pairsLine: Object.keys(project.pairs).length ? 'the other then' : null };
}

function Underlined({ text }: { text: string }) {
  return (
    <>
      {text.split(DOUBLES).map((part, i) => (i % 2 ? <span key={i} className="specimen__double">{part}</span> : <span key={i}>{part}</span>))}
    </>
  );
}

/**
 * The type-specimen poster: a giant pair of letters, a waterfall of sizes, mississippi with its doubled
 * letters marked to show they differ, and a colophon. The same layout is drawn to a PNG for sharing.
 */
export function Specimen({ data }: { data: SpecimenData }) {
  const font = { fontFamily: `"${data.cssFamily}", var(--font-display)` };
  return (
    <div className="specimen-frame">
    <figure className="specimen" aria-label={`Specimen of ${data.family}`}>
      <p className="specimen__hero" style={font}>{data.display}</p>
      <div className="specimen__waterfall" style={font}>
        {WATERFALL.map((size) => (
          <p key={size} style={{ fontSize: `${(size / 1200) * 100}cqw` }}>{SPECIMEN_SAMPLE}</p>
        ))}
      </div>
      <p className="specimen__line" style={font}>
        <Underlined text="mississippi" />
      </p>
      {data.pairsLine && (
        <p className="specimen__line" style={font}>
          {data.pairsLine}
        </p>
      )}
      <figcaption className="specimen__colophon">{data.colophon}</figcaption>
    </figure>
    </div>
  );
}

const W = 1200, H = 1500, PAD = 96;

/** The poster as a 1200 × 1500 PNG, drawn with the live font on a canvas (no SVG or DOM capture). */
export async function specimenPng(data: SpecimenData, colours = POSTER_COLOURS): Promise<Blob> {
  await document.fonts.ready;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colours.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = colours.ink;
  ctx.textBaseline = 'alphabetic';
  const face = (px: number, fam = data.cssFamily) => `${px}px "${fam}", serif`;

  ctx.font = face(520);
  ctx.fillText(data.display, PAD - 12, 560);

  const wrap = (text: string, px: number, maxWidth: number) => {
    ctx.font = face(px);
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    return [...lines, line];
  };

  let y = 700;
  for (const size of WATERFALL) {
    for (const line of wrap(SPECIMEN_SAMPLE, size, W - 2 * PAD)) {
      y += size * 1.15;
      ctx.fillText(line, PAD, y);
    }
    y += size * 0.35;
  }

  const underline = (text: string, px: number, at: number) => {
    ctx.font = face(px);
    ctx.fillText(text, PAD, at);
    ctx.fillStyle = colours.accent;
    for (const m of text.matchAll(DOUBLES)) {
      const x0 = PAD + ctx.measureText(text.slice(0, m.index)).width, w = ctx.measureText(m[0]).width;
      ctx.fillRect(x0, at + px * 0.18, w, Math.max(3, px * 0.04));
    }
    ctx.fillStyle = colours.ink;
  };
  y += 110;
  underline('mississippi', 96, y);
  if (data.pairsLine) {
    y += 120;
    ctx.font = face(96);
    ctx.fillText(data.pairsLine, PAD, y);
  }

  ctx.fillStyle = colours.soft;
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace';
  await document.fonts.load(`28px ${mono}`, data.colophon);
  ctx.font = `28px ${mono}`;
  const colophon: string[] = [];
  let line = '';
  for (const word of data.colophon.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > W - 2 * PAD && line) {
      colophon.push(line);
      line = word;
    } else line = next;
  }
  colophon.push(line);
  colophon.forEach((l, i) => ctx.fillText(l, PAD, H - PAD - (colophon.length - 1 - i) * 42));

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'));
}
