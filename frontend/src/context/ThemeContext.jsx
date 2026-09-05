// src/context/ThemeContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'treniko_theme';
const MODES = ['light', 'dark', 'system'];

/**
 * Light, dark, and actually following the system.
 *
 * ── What was wrong ───────────────────────────────────────────────────────────
 * The provider read `prefers-color-scheme` once, on first render, and
 * immediately wrote the result to localStorage as an explicit choice. From that
 * moment the app had a fixed theme: a trainer whose phone switches to dark at
 * sunset kept the light app, and nothing they had done said they wanted that.
 * There were also only two states, so "follow my device" could not be asked for
 * even deliberately.
 *
 * Three modes now. `system` stores the word "system" rather than a resolved
 * colour and keeps listening to the media query, so the app changes when the
 * device does. Light and dark are explicit and stay put.
 */
const readStoredMode = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(stored)) return stored;
    // Migrate the old two-value storage. Someone who had chosen dark keeps it.
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Private mode, or storage disabled. Falling back to the system preference
    // is the right default and needs no storage at all.
  }
  return 'system';
};

const systemPrefersDark = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Kept in step with the device for as long as the app is open, not just at
  // startup.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = (e) => setSystemDark(e.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // A viewer with storage disabled still gets the right theme for this
      // session; only the memory of it is lost.
    }
  }, [mode, isDark]);

  const value = useMemo(() => ({
    mode,
    isDark,
    setMode: (next) => setMode(MODES.includes(next) ? next : 'system'),
    // Kept for the header's single-button toggle: it cycles through the three
    // modes rather than flipping between two, so "follow my device" is
    // reachable without opening settings.
    toggle: () => setMode(current => (
      current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'
    )),
  }), [mode, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const THEME_MODES = MODES;
