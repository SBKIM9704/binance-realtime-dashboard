"use client";

import { LiveDot } from "@/components/dashboard/live-dot";
import { useApp } from "@/components/providers";

/** Shown until the first SSE frame lands — names the likely cause, not just "loading". */
export function LoadingState() {
  const { t } = useApp();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <LiveDot live />
      <p className="font-sans text-xl font-semibold">{t("loading.title")}</p>
      <p className="text-xs">
        {t("loading.hint")} (<code>npm run dev</code>).
      </p>
    </div>
  );
}
