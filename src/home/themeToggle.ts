import { readTheme, setTheme, type ThemeChoice } from '../ui/theme';

const deviceDark = matchMedia('(prefers-color-scheme: dark)');
const device = (): 'light' | 'dark' => (deviceDark.matches ? 'dark' : 'light');
/** The theme on screen, whether chosen here, in the studio, or by the device. */
const showing = () => {
  const t = readTheme();
  return t === 'system' ? device() : t;
};

/**
 * The home bar's switch between paper and the night desk. Switching back to what the device prefers means
 * following the device again, as "Match this device" does in the studio, so no one is stuck on a choice.
 */
export function mountThemeToggle(button: HTMLButtonElement) {
  const sync = () => button.setAttribute('aria-pressed', String(showing() === 'dark'));
  sync();
  button.addEventListener('click', () => {
    const next = showing() === 'dark' ? 'light' : 'dark';
    const choice: ThemeChoice = next === device() ? 'system' : next;
    const swap = () => {
      setTheme(choice);
      sync();
    };
    // A cross-fade between the two, where the browser has one and motion is welcome.
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(swap);
    else swap();
  });
  deviceDark.addEventListener('change', sync);
}
