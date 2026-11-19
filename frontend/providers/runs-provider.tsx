"use client";

// Processing runs of the user (ADR-02, Docs/fase2/adr/). The projects service
// owns the state of each run; this provider loads it when the dashboard opens,
// follows the run-status events and keeps it for every page, so a run is not
// lost when the user leaves the project page, reloads or opens a new session.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "@/providers/session-provider";
import { useGetSocket } from "@/lib/queries/projects";
import { fetchActiveRuns, fetchRunStatus, ProjectRun } from "@/lib/projects";

type RunsContextValue = {
  runs: Record<string, ProjectRun>;
  // Asks the server for one project's latest run (the project page does it when it opens)
  refreshProject: (pid: string, ownerId?: string, shareId?: string) => Promise<void>;
  // Local update, e.g. right after a cancel
  setRun: (run: ProjectRun) => void;
  // Forgets a finished run (its notice was seen)
  dismiss: (pid: string) => void;
};

const EMPTY: RunsContextValue = {
  runs: {},
  refreshProject: async () => {},
  setRun: () => {},
  dismiss: () => {},
};

const RunsContext = createContext<RunsContextValue>(EMPTY);

// Merges a run into what we know: a newer run of the project wins; within the
// same run a final state is never replaced by "running", and progress never
// goes back (events can be handled out of order by the server).
function merge(current: ProjectRun | undefined, next: ProjectRun): ProjectRun | null {
  if (!current || next.token > current.token) return next;
  if (next.token < current.token) return null;
  if (current.status !== "running") return next.status === "running" ? null : next;
  if (next.status === "running") return { ...next, progress: Math.max(current.progress, next.progress) };
  return next;
}

export function RunsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const socket = useGetSocket(session.token);
  const [runs, setRuns] = useState<Record<string, ProjectRun>>({});
  const runsRef = useRef(runs);
  runsRef.current = runs;

  const setRun = useCallback((run: ProjectRun) => {
    if (!run?.projectId) return;
    setRuns((prev) => {
      const merged = merge(prev[run.projectId], run);
      return merged ? { ...prev, [run.projectId]: merged } : prev;
    });
  }, []);

  const dismiss = useCallback((pid: string) => {
    setRuns((prev) => {
      if (!(pid in prev)) return prev;
      const next = { ...prev };
      delete next[pid];
      return next;
    });
  }, []);

  const refreshProject = useCallback(
    async (pid: string, ownerId?: string, shareId?: string) => {
      try {
        const run = await fetchRunStatus(session.user._id, pid, session.token, ownerId, shareId);
        // A run that ended long ago is not news: only keep a run in progress,
        // or the end of one we were showing as in progress.
        if (run && (run.status === "running" || runsRef.current[pid]?.status === "running")) setRun(run);
      } catch {
        // no access or no answer: keep what we have
      }
    },
    [session.user._id, session.token, setRun],
  );

  // Runs in progress, and the latest state of those we still show as running
  // but the server no longer lists (they ended while we were not listening).
  const loadActive = useCallback(async () => {
    if (!session.token || !session.user?._id) return;
    try {
      const active = await fetchActiveRuns(session.user._id, session.token);
      active.forEach(setRun);
      const listed = new Set(active.map((r) => r.projectId));
      for (const run of Object.values(runsRef.current)) {
        if (run.status === "running" && !listed.has(run.projectId) && run.ownerId === session.user._id) {
          await refreshProject(run.projectId);
        }
      }
    } catch {
      // the next event or reconnection will bring it
    }
  }, [session.token, session.user?._id, setRun, refreshProject]);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  useEffect(() => {
    const s = socket.data;
    if (!s) return;
    const onRunStatus = (run: ProjectRun) => setRun(run);
    s.on("run-status", onRunStatus);
    // events sent while disconnected are lost: ask again on every reconnection
    s.on("connect", loadActive);
    return () => {
      s.off("run-status", onRunStatus);
      s.off("connect", loadActive);
    };
  }, [socket.data, setRun, loadActive]);

  const value = useMemo(
    () => ({ runs, refreshProject, setRun, dismiss }),
    [runs, refreshProject, setRun, dismiss],
  );
  return <RunsContext.Provider value={value}>{children}</RunsContext.Provider>;
}

// Outside the dashboard (e.g. a public share page) there are no runs to follow.
export function useRuns() {
  return useContext(RunsContext);
}
