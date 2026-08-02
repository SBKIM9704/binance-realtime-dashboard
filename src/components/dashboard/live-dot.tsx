import { cn } from "@/lib/utils";

/** Pulsing status dot. Amber when live, muted when offline. */
export function LiveDot({ live, className }: { live: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full",
          live ? "bg-primary motion-safe:animate-pulse-dot" : "bg-muted-foreground/50",
        )}
      />
    </span>
  );
}
