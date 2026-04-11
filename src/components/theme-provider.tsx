"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { UiTheme } from "@/lib/config";

const STORAGE_KEY = "alogi.uiTheme";
const DEFAULT_UI_THEME: UiTheme = "operator-console";

interface UiThemeContextValue {
  uiTheme: UiTheme;
  setUiTheme: (theme: UiTheme) => void;
}

const UiThemeContext = React.createContext<UiThemeContextValue | null>(null);

function applyUiTheme(theme: UiTheme) {
  document.documentElement.setAttribute("data-ui-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

function UiThemeProvider({ children }: { children: React.ReactNode }) {
  const [uiTheme, setUiThemeState] = React.useState<UiTheme>(DEFAULT_UI_THEME);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as UiTheme | null;
    if (stored) {
      setUiThemeState(stored);
      applyUiTheme(stored);
      return;
    }

    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const nextTheme = (data?.ui?.theme as UiTheme | undefined) ?? DEFAULT_UI_THEME;
        setUiThemeState(nextTheme);
        applyUiTheme(nextTheme);
      })
      .catch(() => {
        applyUiTheme(DEFAULT_UI_THEME);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setUiTheme = React.useCallback((theme: UiTheme) => {
    setUiThemeState(theme);
    applyUiTheme(theme);
  }, []);

  return (
    <UiThemeContext.Provider value={{ uiTheme, setUiTheme }}>
      {children}
    </UiThemeContext.Provider>
  );
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <UiThemeProvider>{children}</UiThemeProvider>
    </NextThemesProvider>
  );
}

export function useUiTheme() {
  const context = React.useContext(UiThemeContext);
  if (!context) {
    throw new Error("useUiTheme must be used within a ThemeProvider");
  }
  return context;
}
