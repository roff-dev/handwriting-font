import { meshGradientFragmentShader, ShaderFitOptions, ShaderMount } from '@paper-design/shaders';
import { backdropHeld } from './backdrop';

// Paper Shaders' Mesh Gradient (shaders.paper.design, Apache-2.0): spots of colour that drift and bleed
// into each other, like washes soaking into paper.
const SPEED = 0.1; // of real time: slow enough that a wash takes the best part of a minute to cross the page
const FPS = 30; // the drift is slow enough that 30 frames a second look the same as 60, for half the work
// Only soft washes are drawn here (the grain is CSS, in base.css), so a few pixels stretched over the screen look
// the same as a full set, for a fraction of the work.
const MAX_PIXELS = 400_000;
const WET = 0.12, PROOF = 0.06, DISTORTION = 0.8, SWIRL = 0.1;

type Rgb = [number, number, number];

function token(css: CSSStyleDeclaration, name: string): Rgb {
  const n = parseInt(css.getPropertyValue(name).trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `t` of the way from `a` to `b`, as the shader's 0–1 RGBA. */
function mix(a: Rgb, b: Rgb, t: number): [number, number, number, number] {
  return [0, 1, 2].map((i) => (a[i]! + (b[i]! - a[i]!) * t) / 255).concat(1) as [number, number, number, number];
}

/**
 * Washes drawn from the locked palette and kept close to the paper, so text over them keeps its contrast:
 * the paper itself, the deeper paper of the tab bar, a breath of the wet-ink blue, the lighter sheet, and a
 * trace of proof red.
 */
function colours() {
  const css = getComputedStyle(document.documentElement);
  const paper = token(css, '--paper');
  const spots = [mix(paper, paper, 0), mix(paper, token(css, '--paper-deep'), 1), mix(paper, token(css, '--ink-wet'), WET), mix(paper, token(css, '--sheet'), 1), mix(paper, token(css, '--proof'), PROOF)];
  return { u_colors: spots, u_colorsCount: spots.length };
}

/** Low-memory phones get one still frame, as §9 asks for the paper grain. */
function lowEnd() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return navigator.hardwareConcurrency <= 4 && memory !== undefined && memory <= 4;
}

export function mountBackdrop() {
  const host = document.createElement('div');
  host.className = 'backdrop';
  host.setAttribute('aria-hidden', 'true');
  document.body.prepend(host);
  let mount: ShaderMount;
  try {
    mount = new ShaderMount(
      host,
      meshGradientFragmentShader,
      {
        ...colours(),
        u_distortion: DISTORTION,
        u_swirl: SWIRL,
        u_grainMixer: 0,
        u_grainOverlay: 0,
        u_fit: ShaderFitOptions.cover,
        u_scale: 1,
        u_rotation: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
      },
      // Without a GPU, WebGL falls back to drawing in software, which would cost more than the wash is worth.
      { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true },
      0,
      0,
      1,
      MAX_PIXELS,
    );
  } catch (e) {
    host.remove();
    throw e;
  }
  requestAnimationFrame(() => host.classList.add('backdrop--on'));

  // The mount's own loop runs at the display's rate; this one steps it at FPS, and stops while still.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const still = lowEnd();
  let frame = 0, last = 0, raf = 0, writing = false;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < 1000 / FPS - 2) return;
    // A hidden tab stops rAF; don't jump ahead by however long it was away.
    frame += Math.min(now - last, 100) * SPEED;
    last = now;
    mount.setFrame(frame);
  };
  const play = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (still || reduced.matches || writing || backdropHeld()) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  play();
  reduced.addEventListener('change', play);
  addEventListener('backdrop-hold', play);

  // Hold still while a stroke is being drawn, so the pad has the device to itself.
  addEventListener(
    'pointerdown',
    (e) => {
      if (!(e.target instanceof Element) || !e.target.closest('.pad')) return;
      writing = true;
      play();
    },
    { capture: true, passive: true },
  );
  const lift = () => {
    if (!writing) return;
    writing = false;
    play();
  };
  addEventListener('pointerup', lift, { capture: true, passive: true });
  addEventListener('pointercancel', lift, { capture: true, passive: true });

  // Follow the theme, whether it comes from the system or the manual switch.
  const recolour = () => mount.setUniforms(colours());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);
  new MutationObserver(recolour).observe(document.documentElement, { attributeFilter: ['data-theme'] });
}
