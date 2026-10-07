import { useEffect, useRef } from 'react';

export type InkColours = { ink: string; wet: string; guide: string };

export function inkColours(el: Element): InkColours {
  const s = getComputedStyle(el);
  const read = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return { ink: read('--ink', '#1a1917'), wet: read('--ink-wet', '#1f2a4d'), guide: read('--guide', '#8c8473') };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Blend two #rrggbb colours; `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(ar!, br!)} ${c(ag!, bg!)} ${c(ab!, bb!)})`;
}

/** The ink tokens, kept current when the colour scheme or the manual theme changes. */
export function useInkColours(target: React.RefObject<Element | null>) {
  const colours = useRef<InkColours | null>(null);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const read = () => (colours.current = inkColours(el));
    read();
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      media.removeEventListener('change', read);
      mo.disconnect();
    };
  }, [target]);
  return colours;
}
