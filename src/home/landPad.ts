const LAND_MS = 650;
const LIFT = 'translateY(-14px) rotate(2deg) scale(1.035)'; // held just above the desk, a little askew
const FADE_IN_MS = 200;
const RULE_DELAY_MS = 260; // the guides start once the sheet is down
const RULE_MS = 420;
const RULE_STAGGER_MS = 80;
const AFTER_MS = 380; // the prompt and buttons follow the sheet

/**
 * A spring as a CSS easing: §4.3's glyph-flight spring (stiffness 260, damping 26), sampled over `ms`.
 * It overshoots by about 1%, so the sheet settles rather than stops.
 */
function spring(ms: number, stiffness = 260, damping = 26) {
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const at = (t: number) => 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  const steps = 40;
  return `linear(${Array.from({ length: steps + 1 }, (_, i) => +(i === steps ? 1 : at(((i / steps) * ms) / 1000)).toFixed(4)).join(', ')})`;
}

/**
 * The home pad arrives as a sheet laid on the desk: it comes down from just above, settling onto its angle
 * with its shadow drawing in, and then its guide lines rule themselves across it, top to bottom, before the
 * prompt and buttons appear. If the pad's island hasn't mounted yet, it lands when it does.
 */
export function landPad() {
  const host = document.querySelector<HTMLElement>('.hero__pad');
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const land = () => {
    const pad = host.querySelector<HTMLElement>('.pad');
    if (!pad) return false;
    const rest = getComputedStyle(pad).boxShadow;
    const shade = getComputedStyle(document.documentElement).getPropertyValue('--shadow').trim();
    const lifted = `0 1px 0 rgb(${shade} / 0.03), 0 40px 60px -28px rgb(${shade} / 0.35)`;
    const easing = CSS.supports('animation-timing-function', 'linear(0, 1)') ? spring(LAND_MS) : 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    pad.animate([{ transform: LIFT, boxShadow: lifted }, { transform: 'none', boxShadow: rest }], { duration: LAND_MS, easing });
    pad.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS, easing: 'ease-out' });
    // The guides are listed top to bottom, so they rule in reading order.
    [...pad.querySelectorAll<SVGElement>('.pad__guide')]
      .sort((a, b) => Number(a.getAttribute('y1')) - Number(b.getAttribute('y1')))
      .forEach((line, i) =>
        line.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          delay: RULE_DELAY_MS + i * RULE_STAGGER_MS,
          duration: RULE_MS,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'backwards',
        }),
      );
    for (const part of host.querySelectorAll('.home-pad__prompt, .home-pad__actions')) {
      part.animate([{ opacity: 0 }, { opacity: 1 }], { delay: AFTER_MS, duration: 300, easing: 'ease-out', fill: 'backwards' });
    }
    return true;
  };
  if (land()) return;
  const watch = new MutationObserver(() => land() && watch.disconnect());
  watch.observe(host, { childList: true, subtree: true });
}
