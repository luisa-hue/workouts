export const THEMES = ['System', 'Dark', 'Light'] as const;
export type Theme = (typeof THEMES)[number];

const KEY = 'workouts.theme';
const BAR = { Dark: '#000000', Light: '#f2f2f7' } as const;

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'Dark' || v === 'Light') return v;
  } catch {
    /* storage unavailable */
  }
  return 'System';
}

/** Applies the theme to the page and the browser bar colour. System follows the phone. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (theme === 'System') {
    root.removeAttribute('data-theme');
    metas.forEach((m) => {
      const original = m.dataset.original;
      if (original) m.content = original;
    });
  } else {
    root.setAttribute('data-theme', theme.toLowerCase());
    metas.forEach((m) => {
      if (!m.dataset.original) m.dataset.original = m.content;
      m.content = BAR[theme];
    });
  }
}

export function saveTheme(theme: Theme): void {
  try {
    if (theme === 'System') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable */
  }
  applyTheme(theme);
}
