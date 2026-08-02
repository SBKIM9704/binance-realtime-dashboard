"use client";

import { AppHeader } from "@/components/dashboard/app-header";
import { BackfillPanel } from "@/components/dashboard/backfill-panel";
import { LoadingState } from "@/components/dashboard/loading-state";
import { StatusRibbon } from "@/components/dashboard/status-ribbon";
import { SnapshotProvider, useDashboardSnapshot } from "@/components/snapshot-provider";
import { cn } from "@/lib/utils";

/**
 * Dashboard shell. Owns the viewport box: from `lg` up the shell is exactly one
 * screen tall and never scrolls, so each view sizes its panels against the space
 * that is left and scrolls internally where content is unbounded. Below `lg` it
 * falls back to normal document flow.
 *
 * The header and the health ribbon live here rather than in the views: whichever
 * view is open, "is the pipeline OK?" is answered without a click.
 */
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotProvider>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1600px] flex-col gap-4 px-4 py-4 lg:h-[100dvh] lg:overflow-hidden lg:px-6">
        <AppHeader />
        <ShellBody>{children}</ShellBody>
      </div>
    </SnapshotProvider>
  );
}

function ShellBody({ children }: { children: React.ReactNode }) {
  const { snapshot, stale } = useDashboardSnapshot();
  if (!snapshot) return <LoadingState />;

  return (
    <>
      <StatusRibbon snapshot={snapshot} />
      {/* Cold-start progress. Above the views rather than inside one, because a
          half-filled database is why *either* view looks thin — and it removes
          itself the moment the fills land. */}
      <BackfillPanel snapshot={snapshot} />
      {/*
        Every number below this point came from the last frame. Once that frame is
        stale, draining it visually is the honest thing to do — a monitoring page
        showing held values at full confidence is exactly the failure it exists to
        catch. The ribbon above stays at full strength because it now reports the
        disconnection itself.
      */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-[opacity,filter] duration-500",
          stale && "opacity-50 saturate-50",
        )}
        aria-busy={stale}
      >
        {children}
      </div>
    </>
  );
}
