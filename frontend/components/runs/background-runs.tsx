"use client";

// Background work panel (ADR-02, Docs/fase2/adr/): the runs of other projects,
// shown on every page of the dashboard, and the notice when one of them ends.
// It never blocks the page: it sits in a corner and takes only the space of
// its entries. The project open on the current page shows its own run in its
// header, so it is left out here.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useRuns } from "@/providers/runs-provider";
import { useSession } from "@/providers/session-provider";

export function BackgroundRuns() {
  const { runs, dismiss } = useRuns();
  const session = useSession();
  const path = usePathname();
  const current = /^\/dashboard\/([0-9a-f]{24})/.exec(path ?? "")?.[1];

  const entries = Object.values(runs)
    .filter((r) => r.projectId !== current && r.status !== "cancelled")
    .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
  if (entries.length === 0) return null;

  return (
    <aside
      aria-label="Background processing"
      className="fixed bottom-4 right-4 z-40 flex w-72 flex-col gap-2"
    >
      {entries.map((run) => {
        if (run.status === "running") {
          return (
            <div key={run.projectId} className="rounded-md border bg-background p-3 shadow-md">
              <div className="flex items-center gap-2 text-sm">
                <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" />
                <span className="truncate font-medium">{run.projectName}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {Math.floor(run.progress)}%
                </span>
              </div>
              <Progress value={run.progress} className="mt-2" />
            </div>
          );
        }

        // Finished: a notice that stays until the user dismisses it or opens the results.
        // Only a finished run is announced (role status/alert), never one in progress.
        const ok = run.status === "done";
        const own = run.ownerId === session.user._id;
        return (
          <div
            key={run.projectId}
            role={ok ? "status" : "alert"}
            className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm shadow-md"
          >
            {ok ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium break-words">{run.projectName}</span>{" "}
                {ok ? "finished processing." : "could not be processed."}
              </p>
              {!ok && run.error?.msg && (
                <p className="text-xs text-muted-foreground">{run.error.msg}</p>
              )}
              {ok && own && (
                <Link
                  href={`/dashboard/${run.projectId}?mode=results&view=grid`}
                  onClick={() => dismiss(run.projectId)}
                  className="text-xs underline"
                >
                  View results
                </Link>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label="Dismiss"
              onClick={() => dismiss(run.projectId)}
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}
    </aside>
  );
}
