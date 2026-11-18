"use client";

// RNF-F2-02: keeps the state of the user's processing runs for the whole
// dashboard. The source of truth is the projects service (runs collection);
// this provider only mirrors it from the REST snapshot and the "run-update"
// socket events, so the progress survives reloads and page changes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "@/providers/session-provider";
import { useGetSocket } from "@/lib/queries/projects";
import { fetchActiveRuns, ProjectRun } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";

// Fallback refresh while a run is active, in case a socket event is lost.
const FALLBACK_REFRESH_MS = 5000;
// A run that ended before this window is not announced again on load.
const NOTIFY_WINDOW_MS = 60000;
const NOTIFIED_KEY = "picturas-notified-runs";

interface RunsContextData {
  runs: Record<string, ProjectRun>;
  getRun: (projectId: string) => ProjectRun | undefined;
  upsertRun: (run: ProjectRun) => void;
}

const RunsContext = createContext<RunsContextData | undefined>(undefined);

const runKey = (run: ProjectRun) => `${run.projectId}:${run.token}`;

function readNotified(): Set<string> {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeNotified(keys: Set<string>) {
  try {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...keys].slice(-50)));
  } catch {
    /* storage unavailable: only duplicate toasts are possible */
  }
}

// Keeps the newest information: a higher token wins, and for the same token
// a finished state or a higher percentage wins (events can arrive out of order).
function isNewer(next: ProjectRun, prev?: ProjectRun) {
  if (!prev) return true;
  if (next.token !== prev.token) return next.token > prev.token;
  if (prev.state !== "running") return false;
  if (next.state !== "running") return true;
  return next.percent >= prev.percent;
}

export function RunsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const { toast } = useToast();
  const socket = useGetSocket(session.token);

  const [runs, setRuns] = useState<Record<string, ProjectRun>>({});
  const notified = useRef<Set<string> | null>(null);

  const notify = useCallback(
    (run: ProjectRun) => {
      if (run.state === "running") return;
      if (!notified.current) notified.current = readNotified();
      const key = runKey(run);
      if (notified.current.has(key)) return;

      const finishedAt = run.finishedAt ? Date.parse(run.finishedAt) : Date.now();
      if (Date.now() - finishedAt > NOTIFY_WINDOW_MS) return;

      notified.current.add(key);
      writeNotified(notified.current);

      const name = run.projectName || "projeto";
      if (run.state === "completed") {
        toast({ title: `Processamento de "${name}" concluído.` });
      } else if (run.state === "cancelled") {
        toast({ title: `Processamento de "${name}" cancelado.` });
      } else {
        toast({
          title: `Falha no processamento de "${name}".`,
          description: run.error ?? undefined,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const upsertRun = useCallback(
    (run: ProjectRun) => {
      if (!run?.projectId) return;
      setRuns((prev) =>
        isNewer(run, prev[run.projectId])
          ? { ...prev, [run.projectId]: run }
          : prev,
      );
      notify(run);
    },
    [notify],
  );

  const refresh = useCallback(async () => {
    if (!session.user?._id || !session.token) return;
    try {
      const active = await fetchActiveRuns(session.user._id, session.token);
      active.forEach(upsertRun);
    } catch {
      /* the next socket event or refresh will catch up */
    }
  }, [session.user?._id, session.token, upsertRun]);

  // Snapshot on mount (covers reloads and new sessions).
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates pushed by the projects service through the ws_gateway.
  useEffect(() => {
    const s = socket.data;
    if (!s) return;
    const onRun = (run: ProjectRun) => upsertRun(run);
    const onReconnect = () => refresh();
    s.on("run-update", onRun);
    s.on("connect", onReconnect);
    return () => {
      s.off("run-update", onRun);
      s.off("connect", onReconnect);
    };
  }, [socket.data, upsertRun, refresh]);

  // Fallback refresh only while something is running.
  const anyRunning = Object.values(runs).some((r) => r.state === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(refresh, FALLBACK_REFRESH_MS);
    return () => clearInterval(id);
  }, [anyRunning, refresh]);

  const getRun = useCallback((pid: string) => runs[pid], [runs]);

  return (
    <RunsContext.Provider value={{ runs, getRun, upsertRun }}>
      {children}
    </RunsContext.Provider>
  );
}

export function useRuns() {
  const ctx = useContext(RunsContext);
  if (!ctx) throw new Error("useRuns must be used within a RunsProvider");
  return ctx;
}
