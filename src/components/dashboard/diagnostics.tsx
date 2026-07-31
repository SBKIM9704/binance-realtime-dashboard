"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers";
import type { DashboardSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OpsStrip } from "./ops-strip";
import { SystemStrip } from "./system-strip";

/**
 * Collapsible detail panel (default collapsed). Keeps the dense System +
 * Pipeline metric grids one click away so the main view stays scannable.
 */
export function Diagnostics({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30"
      >
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <div>
          <div className="font-sans font-semibold text-lg leading-none text-foreground">
            {t("diagnostics.title")}
          </div>
          <div className="label mt-1">{t("diagnostics.hint")}</div>
        </div>
        <span className="label ml-auto">{open ? t("diagnostics.hide") : t("diagnostics.show")}</span>
      </button>

      {open && (
        <div className="animate-fade-up space-y-4 border-t border-border p-4">
          <SystemStrip system={snapshot.system} />
          <OpsStrip snapshot={snapshot} now={snapshot.ts} />
        </div>
      )}
    </div>
  );
}
