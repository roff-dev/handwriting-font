import { useCallback, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'theme';

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice = readTheme()) {
  if (choice === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = choice;
}

/** Keeps the theme for this viewer, in this browser only, and applies it. */
export function setTheme(t: ThemeChoice) {
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
  applyTheme(t);
}

/** The manual theme, kept per viewer in this browser only. */
export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [theme, setState] = useState(readTheme);
  const set = useCallback((t: ThemeChoice) => {
    setTheme(t);
    setState(t);
  }, []);
  return [theme, set];
}
