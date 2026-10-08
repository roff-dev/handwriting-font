const WIPE_MS = 450;
const STAGGER_MS = 40;

/**
 * Split the headline into one span per character, keeping the readable text in a visually hidden copy so
 * screen readers hear the sentence, not the letters. The text is static HTML first, so it's what paints.
 */
export function splitHeadline(h1: HTMLElement): HTMLElement[] {
  const text = h1.textContent ?? '';
  const spoken = Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: text });
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  const letters = [...text].map((ch) => {
    const span = Object.assign(document.createElement('span'), { className: 'hero__letter', textContent: ch });
    span.dataset.ch = ch;
    shown.append(span);
    return span;
  });
  h1.replaceChildren(spoken, shown);
  return letters;
}

/**
 * Set every letter the visitor has drawn in their font. Letters drawn just now are revealed with a
 * left-to-right ink wipe, staggered across the headline; the others switch silently to the newer build.
 */
export function applyHand(letters: HTMLElement[], family: string, drawn: Set<string>, fresh: Set<string>) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let order = 0;
  for (const span of letters) {
    const ch = span.dataset.ch!;
    if (!drawn.has(ch)) continue;
    span.style.fontFamily = `"${family}", var(--font-display)`;
    span.classList.add('hero__letter--hand');
    if (!fresh.has(ch)) continue;
    const keyframes = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% 0 -20% 0)' }];
    span.animate(keyframes, { duration: reduced ? 150 : WIPE_MS, delay: reduced ? 0 : order++ * STAGGER_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' });
  }
}
