"use client";

import { cn } from "@/lib/utils";

export interface ToggleItem {
  value: string;
  label: string;
}

/**
 * One segmented control for the whole dashboard. `outlined` reads as a control
 * that scopes a panel (symbol); `plain` reads as a secondary filter inside one
 * (timeframe). Both selected states come from here so a restyle is one edit.
 */
export function ToggleGroup({
  items,
  active,
  onSelect,
  variant = "outlined",
  className,
  ariaLabel,
}: {
  items: ToggleItem[];
  active: string;
  onSelect: (value: string) => void;
  variant?: "outlined" | "plain";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)} role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.value === active;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onSelect(item.value)}
            aria-pressed={selected}
            className={cn(
              // min-h-6 keeps the hit area at the WCAG 2.5.8 floor (24px) even
              // though the plain variant's type is only 11px.
              "tnum inline-flex min-h-6 items-center justify-center rounded-sm transition-colors",
              variant === "outlined"
                ? "border px-3 py-1 text-xs"
                : "px-2 py-0.5 text-[11px]",
              selected
                ? variant === "outlined"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "bg-primary/15 text-primary"
                : variant === "outlined"
                  ? "border-border text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Symbol switcher — the roster with the quote currency trimmed off. */
export function SymbolTabs({
  symbols,
  active,
  onSelect,
  className,
}: {
  symbols: string[];
  active: string;
  onSelect: (symbol: string) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      items={symbols.map((s) => ({ value: s, label: s.replace("USDT", "") }))}
      active={active}
      onSelect={onSelect}
      className={className}
    />
  );
}
