"use client";

import { createContext, useContext, useState } from "react";
import { type Lang, type TKey, translate } from "@/lib/i18n";

export type Theme = "dark" | "light";

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string>) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

const THEME_KEY = "theme";
const LANG_KEY = "lang";
const ONE_YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/**
 * Theme + language are stored in cookies so the server can render the correct
 * theme class and <html lang> on the first request (no flash). Initial values
 * come from the server (read from cookies in the root layout).
 */
export function AppProviders({
  children,
  initialTheme,
  initialLang,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
  initialLang: Lang;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [lang, setLangState] = useState<Lang>(initialLang);

  const applyTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    setCookie(THEME_KEY, next);
  };

  const toggleTheme = () => applyTheme(theme === "dark" ? "light" : "dark");

  const setLang = (l: Lang) => {
    setLangState(l);
    setCookie(LANG_KEY, l);
  };

  const t = (key: TKey, vars?: Record<string, string>) => translate(lang, key, vars);

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, setLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProviders>");
  return ctx;
}
