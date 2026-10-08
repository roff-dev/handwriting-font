/**
 * A slow wash of ink soaking into paper behind every page (see backdropShader.ts). It loads once the page
 * is idle, so it never competes with the first paint or the first stroke; until then, and anywhere
 * WebGL 2 is missing, the plain paper colour shows.
 */
export function startBackdrop() {
  const go = () =>
    import('./backdropShader')
      .then((m) => m.mountBackdrop())
      .catch(() => {
        // No WebGL 2, or the chunk didn't load: the plain paper is the fallback, and it's fine.
      });
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go, 200));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

let holds = 0;

/** Holds the backdrop still while `work` runs, so heavy work (reading a photo) has the device to itself. */
export async function holdBackdrop<T>(work: () => Promise<T>): Promise<T> {
  holds++;
  dispatchEvent(new Event('backdrop-hold'));
  try {
    return await work();
  } finally {
    holds--;
    dispatchEvent(new Event('backdrop-hold'));
  }
}

export const backdropHeld = () => holds > 0;
