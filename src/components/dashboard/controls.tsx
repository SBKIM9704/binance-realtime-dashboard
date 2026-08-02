"use client";

import { Moon, Sun } from "lucide-react";
import { useApp } from "@/components/providers";
import { LANGS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Theme (dark/light) and language (ko/en) toggles for the header. */
export function Controls() {
  const { theme, toggleTheme, lang, setLang, t } = useApp();

  return (
    <div className="flex items-center gap-2">
      {/* Language */}
      <div className="flex overflow-hidden rounded-sm border border-border" role="group" aria-label={t("header.language")}>
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={cn(
              "min-h-6 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
              lang === l
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Theme */}
      <button
        onClick={toggleTheme}
        aria-label={t("header.theme")}
        title={t("header.theme")}
        className="flex h-6 w-6 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:text-foreground"
      >
        {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
      </button>
    </div>
  );
}
