"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "biztrack_theme";
const DEFAULT_THEME: Theme = "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with the default so SSR and the initial client render agree.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Sync with whatever the no-flash script already applied / what's stored.
  useEffect(() => {
    let stored: Theme | null = null;
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (value === "light" || value === "dark") stored = value;
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
    const initial = stored ?? DEFAULT_THEME;
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyThemeClass(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Inline script that runs before React hydrates to apply the persisted theme
 * (or the default) immediately, preventing a flash of the wrong theme.
 */
export const themeNoFlashScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme = (stored === 'light' || stored === 'dark') ? stored : '${DEFAULT_THEME}';
    var root = document.documentElement;
    if (theme === 'dark') { root.classList.add('dark'); }
    else { root.classList.remove('dark'); }
  } catch (e) {}
})();
`;
