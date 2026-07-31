"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_LANG, type Lang, type TKey, translate } from "@/lib/i18n";

export type Theme = "dark" | "light";

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string>) => string;
  /** False until client-side state is hydrated — used to avoid mismatched toggles. */
  mounted: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const THEME_KEY = "theme";
const LANG_KEY = "lang";

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Server + first client render must match: dark theme (see no-flash script) and default lang.
  const [theme, setThemeState] = useState<Theme>("dark");
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    const storedLang = localStorage.getItem(LANG_KEY) as Lang | null;
    setThemeState(
      storedTheme ??
        (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    );
    if (storedLang === "ko" || storedLang === "en") setLangState(storedLang);
    setMounted(true);
  }, []);

  const applyTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  const toggleTheme = () => applyTheme(theme === "dark" ? "light" : "dark");

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };

  const t = (key: TKey, vars?: Record<string, string>) => translate(lang, key, vars);

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, setLang, t, mounted }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProviders>");
  return ctx;
}
