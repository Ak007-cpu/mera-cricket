import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UiTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'crex_ui_theme';

interface ThemeContextValue {
  theme: UiTheme;
  isDark: boolean;
  setTheme: (theme: UiTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDark: true,
  setTheme: () => {},
  toggleTheme: () => {}
});

function readStoredTheme(): UiTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{
  forceDark?: boolean;
  children: React.ReactNode;
}> = ({ forceDark = false, children }) => {
  const [theme, setThemeState] = useState<UiTheme>(readStoredTheme);

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: UiTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const effectiveDark = forceDark ? true : theme === 'dark';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', effectiveDark);

    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', effectiveDark ? '#0f172a' : '#f1f5f9');
    }
  }, [effectiveDark]);

  return (
    <ThemeContext.Provider
      value={{
        theme: effectiveDark ? 'dark' : 'light',
        isDark: effectiveDark,
        setTheme,
        toggleTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
