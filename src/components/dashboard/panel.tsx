import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Titled panel whose body scrolls inside a fixed frame. Used wherever a view fills
 * the viewport and the content (event stream, candle rows, chart canvas) must not
 * grow the page. One panel chrome for the whole dashboard — the header padding and
 * rule live here so Market and Ops cannot drift apart.
 *
 * `scroll={false}` for a body that manages its own size, like a canvas.
 */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  scroll = true,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate font-sans text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <div className="label mt-0.5 truncate">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className={cn("min-h-0 flex-1", scroll ? "overflow-auto" : "overflow-hidden")}>
        {children}
      </div>
    </Card>
  );
}
