import { GLYPHS, UNITS_PER_EM } from './headlineGlyphs';
import { landPad } from './landPad';

const SVG = 'http://www.w3.org/2000/svg';
const TITLE_EM = 5; // ems of the title, read along it, that the writing moves on per second
const DRAW_MS = 150; // every letter takes at least this long to draw, however small
const OUTLINE_EM = 12; // ems of outline a letter's pen travels per second on top of that
const PEN_EM = 0.18; // the pen is wide enough to fill a stem from one side of it
const DRY_MS = 600; // §4.3: ink settles from wet to dry over 600 ms
const FADE_MS = 150; // §4.3: with reduced motion, a short fade instead
// Once the page has waited this long for the script or the headline's font, it shows everything at once.
const LATE_MS = 1500;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** Where each letter's glyph origin sits on its baseline, relative to the headline. */
function origins(h1: HTMLElement, letters: HTMLElement[]) {
  // How far the baseline sits below the top of a letter's box, measured on a copy out of the flow: a probe
  // among the letters themselves would give the line a new place to wrap.
  const copy = Object.assign(document.createElement('div'), { style: 'position:absolute;visibility:hidden;white-space:nowrap' });
  const letter = copy.appendChild(Object.assign(document.createElement('span'), { textContent: 'x' }));
  const baseline = copy.appendChild(Object.assign(document.createElement('span'), { style: 'display:inline-block;width:0;height:0' }));
  h1.append(copy);
  const drop = baseline.getBoundingClientRect().bottom - letter.getBoundingClientRect().top;
  copy.remove();
  const box = h1.getBoundingClientRect();
  return letters.map((span) => {
    const r = span.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top + drop - box.top };
  });
}

/**
 * The headline writes itself onto the page before anything else appears. Each letter is drawn along its own
 * outline by a pen wide enough to fill it, clipped to the letter, so it fills in the order its strokes run:
 * round the bowl of an o, up and down the stem of an h, the dot of an i after its stem. Each letter starts
 * as far into the writing as it is along the title, so the writing moves through it at one pace, lines and
 * all, with a few letters in hand at once; each lands in wet ink and dries. Then the rest of the page fades
 * in (home.css) and the pad is laid on the desk (landPad.ts). Any key, click, touch, scroll or resize skips
 * to the end. Resolves once the page is showing.
 */
export async function writeHeadline(h1: HTMLElement, letters: HTMLElement[]): Promise<void> {
  const body = document.body;
  const show = () => {
    body.classList.remove('intro-run');
    body.classList.add('intro-done');
    landPad();
  };
  // Draw over the headline's own face: in a fallback, the drawing wouldn't land on the letters.
  const face = '1em "Instrument Serif"';
  await Promise.race([document.fonts.load(face), wait(LATE_MS - performance.now())]).catch(() => {});
  if (performance.now() > LATE_MS || !document.fonts.check(face)) return show();

  const writing: Animation[] = [];
  const drying: Animation[] = [];
  let ink: SVGSVGElement | undefined;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    writing.push(h1.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, fill: 'backwards' }));
  } else {
    const css = getComputedStyle(document.documentElement);
    const [wet, dry] = ['--ink-wet', '--ink'].map((name) => css.getPropertyValue(name).trim());
    const size = parseFloat(getComputedStyle(h1).fontSize);
    const scale = size / UNITS_PER_EM;
    const at = origins(h1, letters);
    // A 1px sheet the drawing overflows, so it can never make the page scroll sideways.
    ink = el('svg', { class: 'hero__ink', 'aria-hidden': 'true', width: 1, height: 1 });

    let along = 0; // ems of the title before this letter
    letters.forEach((span, i) => {
      const start = (along / TITLE_EM) * 1000;
      along += span.getBoundingClientRect().width / size;
      const glyph = GLYPHS[span.dataset.ch!];
      if (!glyph) return;
      const g = el('g', { transform: `translate(${at[i]!.x} ${at[i]!.y}) scale(${scale})`, fill: 'none', stroke: 'currentColor', 'stroke-width': PEN_EM * UNITS_PER_EM, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      const clip = el('clipPath', { id: `hero-ink-${i}` });
      clip.append(el('path', { d: glyph.contours.map((c) => c.d).join('') }));
      const pen = el('g', { 'clip-path': `url(#hero-ink-${i})` });
      g.append(clip, pen);
      ink!.append(g);

      // Each separate piece of the letter is a stroke of its own, longest first (an i's stem before its dot),
      // sharing the letter's time by length; its holes are traced alongside the first, in the same time.
      const pieces = glyph.contours.filter((c) => !c.hole).sort((a, b) => b.length - a.length);
      const holes = glyph.contours.filter((c) => c.hole);
      const outline = pieces.reduce((sum, c) => sum + c.length, 0);
      const total = DRAW_MS + (outline / UNITS_PER_EM / OUTLINE_EM) * 1000;
      let t = start;
      pieces.forEach((piece, n) => {
        const duration = (total * piece.length) / outline;
        for (const contour of n === 0 ? [piece, ...holes] : [piece]) {
          const path = el('path', { d: contour.d });
          pen.append(path);
          const length = path.getTotalLength();
          path.style.strokeDasharray = `${length} ${length}`;
          path.style.strokeDashoffset = `${length}`;
          writing.push(path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { delay: t, duration, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }));
        }
        t += duration;
      });
      if (wet && dry) drying.push(g.animate([{ color: wet }, { color: dry }], { delay: t, duration: DRY_MS, easing: 'ease-out', fill: 'both' }));
    });
    h1.append(ink);
    h1.classList.add('hero__title--drawing');
  }
  body.classList.add('intro-run');

  const skip = () => [...writing, ...drying].forEach((a) => a.finish());
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'resize'] as const;
  for (const e of events) addEventListener(e, skip, { capture: true, passive: true });
  await Promise.all(writing.map((a) => a.finished)).catch(() => {});
  show();
  // The drawing gives way to the real text once its ink has dried.
  await Promise.all(drying.map((a) => a.finished)).catch(() => {});
  for (const e of events) removeEventListener(e, skip, { capture: true });
  ink?.remove();
  h1.classList.remove('hero__title--drawing');
}
