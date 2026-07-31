"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TabDef {
  key: string;
  label: string;
  content: React.ReactNode;
}

/** Lightweight tabbed panel — one card, switchable bodies, scrolls internally. */
export function PanelTabs({ tabs, className }: { tabs: TabDef[]; className?: string }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            aria-selected={tab.key === active}
            className={cn(
              "px-4 py-2.5 text-xs font-medium tracking-wide transition-colors",
              tab.key === active
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{current?.content}</div>
    </Card>
  );
}
