"use client";

// UC-VID-001 / UC-VID-003 — Recortar, aplicar ferramentas e exportar.
// Panel docked next to the toolbar while a video is open in the carousel:
// the tool chosen in the toolbar (Trim / Apply) + the requests of this video.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { LoaderCircle, Play, Scissors, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useProjectInfo } from "@/providers/project-provider";
import { useCurrentVideo, VideoToolPanel } from "@/providers/current-video-provider";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/hooks/use-toast";
import { useGetVideoJobs, videoJobsKey } from "@/lib/queries/video-jobs";
import { useQueryClient } from "@tanstack/react-query";
import { VideoApplyPanel } from "./video-apply-panel";
import { applyToolDescription } from "@/lib/video-apply";
import {
  fetchProjectVideoUrl,
  getVideoErrorMessage,
  ProjectVideo,
} from "@/lib/videos";
import {
  cancelVideoJob,
  downloadVideo,
  formatTimecode,
  isActiveJob,
  parseTimecode,
  trimJobDescription,
  TrimMode,
  trimResultDuration,
  trimSelectionError,
  VIDEO_JOB_STATE_LABELS,
  VideoJob,
} from "@/lib/video-jobs";
import { TrimModeToggle, useTrimSubmit } from "./trim-submit";

export function useVideoUrl(videoId: string | null | undefined) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();

  return useQuery({
    queryKey: ["projectVideoUrl", session.user._id, pid, videoId],
    queryFn: () =>
      fetchProjectVideoUrl({
        uid: session.user._id,
        pid,
        token: session.token,
        videoId: videoId!,
      }),
    enabled: !!videoId,
    staleTime: 30 * 60 * 1000, // the url is signed for 1 h
  });
}

// REQ-021: download a video of the library under its own name
export function useExportVideo() {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportVideo(videoId: string, name: string) {
    setExporting(videoId);
    try {
      const url = await fetchProjectVideoUrl({
        uid: session.user._id,
        pid,
        token: session.token,
        videoId,
      });
      await downloadVideo(url, name);
    } catch (error) {
      toast({
        title: "Não foi possível exportar o vídeo",
        description: getVideoErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  }

  return { exportVideo, exporting };
}

// ------------------------------------------------------------------- trim

function TrimPanel({ video }: { video: ProjectVideo }) {
  const session = useSession();
  // the player of the carousel, where the video is being watched, and the
  // selection, shared with the tracks (where it can be dragged)
  const { player, trim, setTrim } = useCurrentVideo();
  const { submitTrim, submitting } = useTrimSubmit(video);

  const duration = video.duration ?? 0;
  const maxEnd = Math.max(1, Math.ceil(duration));
  const selection = trim ?? { start: 0, end: maxEnd, mode: "keep" as TrimMode };
  const mode = selection.mode;

  const [startText, setStartText] = useState(formatTimecode(selection.start));
  const [endText, setEndText] = useState(formatTimecode(selection.end));
  const [previewing, setPreviewing] = useState(false);

  // the handles on the tracks moved: the fields follow
  useEffect(() => {
    if (parseTimecode(startText) !== selection.start) setStartText(formatTimecode(selection.start));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.start]);
  useEffect(() => {
    if (parseTimecode(endText) !== selection.end) setEndText(formatTimecode(selection.end));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.end]);

  const start = parseTimecode(startText);
  const end = parseTimecode(endText);
  // E4 / REQ-003: validated while the user types
  const invalid = trimSelectionError(start, end, duration, mode, video.codec);

  const isFree = session.user.type === "free";
  const remaining = session.user.remaining_operations;
  const noOperations = isFree && remaining != null && remaining <= 0;

  function changeText(which: "start" | "end", text: string) {
    if (which === "start") setStartText(text);
    else setEndText(text);
    const value = parseTimecode(text);
    if (value !== null) setTrim({ ...selection, [which]: value });
  }

  function setFromSlider([s, e]: number[]) {
    setTrim({ ...selection, start: s, end: e });
    if (player) player.currentTime = s;
  }

  function takeCurrentTime(which: "start" | "end") {
    changeText(which, formatTimecode(Math.round(player?.currentTime ?? 0)));
  }

  // plays the result without processing anything: the interval, or (when it
  // is removed) a few seconds before it, jumping over it
  function preview() {
    if (!player || invalid || start === null) return;
    player.currentTime = mode === "keep" ? start : Math.max(0, start - 3);
    setPreviewing(true);
    player.play().catch(() => setPreviewing(false));
  }

  useEffect(() => {
    if (!player || !previewing || start === null || end === null) return;
    const stopAt = mode === "keep" ? end : Math.min(duration, end + 3);
    let jumped = false;
    const onTime = () => {
      if (mode === "remove" && !jumped && player.currentTime >= start) {
        jumped = true;
        player.currentTime = Math.min(end, duration);
        if (start === 0) return;
      }
      if (player.currentTime >= stopAt || player.ended) {
        player.pause();
        setPreviewing(false);
      }
    };
    player.addEventListener("timeupdate", onTime);
    return () => player.removeEventListener("timeupdate", onTime);
  }, [player, previewing, start, end, mode, duration]);

  const sliderValue = [
    Math.min(start ?? 0, maxEnd),
    Math.min(end ?? maxEnd, maxEnd),
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Arraste as extremidades da seleção nas faixas de vídeo e áudio, por baixo
        do vídeo, ou escreva os instantes aqui.
      </p>

      <TrimModeToggle mode={mode} onChange={(m) => setTrim({ ...selection, mode: m })} />

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Duração total: {formatTimecode(duration)}</span>
          {!invalid && start !== null && end !== null && (
            <span className="font-medium text-foreground">
              Fica com: {formatTimecode(trimResultDuration(start, end, duration, mode))}
            </span>
          )}
        </div>
        <SliderPrimitive.Root
          className="relative flex w-full touch-none select-none items-center py-2"
          min={0}
          max={maxEnd}
          step={1} // RN2: resolution of 1 s
          minStepsBetweenThumbs={1}
          value={sliderValue}
          onValueChange={setFromSlider}
          aria-label="Intervalo selecionado"
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
            <SliderPrimitive.Range
              className={`absolute h-full ${mode === "remove" ? "bg-destructive" : "bg-primary"}`}
            />
          </SliderPrimitive.Track>
          {["Início", "Fim"].map((label) => (
            <SliderPrimitive.Thumb
              key={label}
              aria-label={label}
              className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ))}
        </SliderPrimitive.Root>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {(
          [
            ["start", "Início", startText],
            ["end", "Fim", endText],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`trim-${key}`}>{label} (m:ss)</Label>
            <div className="flex gap-1">
              <Input
                id={`trim-${key}`}
                value={value}
                onChange={(e) => changeText(key, e.target.value)}
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                title="Usar a posição atual do vídeo"
                onClick={() => takeCurrentTime(key)}
              >
                Posição atual
              </Button>
            </div>
          </div>
        ))}
      </div>

      {invalid && <p className="text-sm text-destructive">{invalid}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isFree && remaining != null
            ? `Operações diárias restantes: ${remaining}. Um recorte conta 1 operação, só se for concluído.`
            : "Plano Premium: sem limite diário de operações."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!!invalid || !player} onClick={preview}>
            <Play /> Pré-visualizar
          </Button>
          <Button
            disabled={!!invalid || submitting || noOperations}
            onClick={() => start !== null && end !== null && submitTrim({ start, end, mode })}
          >
            {submitting ? <LoaderCircle className="animate-spin" /> : <Scissors />}
            Aplicar recorte
          </Button>
        </div>
      </div>
      {noOperations && (
        <p className="text-sm text-destructive">
          Atingiu o limite de 5 operações diárias. Com o plano Premium não tem limite diário.
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------- request

// The request in progress for this video: state, progress and Cancelar (and,
// if the last one failed, why). There is no list of requests: a tool changes
// the video itself, so there is nothing else to open or export here.
function CurrentJob({ video }: { video: ProjectVideo }) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const jobs = useGetVideoJobs(session.user._id, pid, session.token);
  const [cancelling, setCancelling] = useState(false);
  // the request that was running, to say when it has replaced the video
  const running = useRef<string | null>(null);

  const job = useMemo(
    () =>
      (jobs.data ?? [])
        .filter((j) => j.video_id === video._id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0],
    [jobs.data, video._id],
  );

  useEffect(() => {
    if (!job) return;
    if (isActiveJob(job)) running.current = job._id;
    else if (running.current === job._id) {
      running.current = null;
      if (job.state === "completed")
        toast({
          title: job.tool === "trim" ? "Vídeo recortado" : "Ferramentas aplicadas",
          description: `"${job.result_name}" foi substituído pelo resultado.`,
        });
    }
  }, [job, toast]);

  if (!job || !(isActiveJob(job) || job.state === "failed")) return null;

  async function cancel() {
    setCancelling(true);
    try {
      const updated = await cancelVideoJob({
        uid: session.user._id,
        pid,
        token: session.token,
        jobId: job!._id,
      });
      qc.setQueryData<VideoJob[]>(
        videoJobsKey(session.user._id, pid, session.token),
        (list) => list?.map((j) => (j._id === updated._id ? updated : j)),
      );
      toast({ title: "Pedido cancelado", description: "O vídeo não foi alterado." });
    } catch (error) {
      toast({
        title: "Não foi possível cancelar",
        description: getVideoErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {job.tool === "trim" ? "Recortar" : "Aplicar ferramentas"}
          </p>
          <p className="text-xs text-muted-foreground">
            {job.tool === "trim"
              ? trimJobDescription(job.params)
              : job.params.tools.map(applyToolDescription).join(" → ")}
          </p>
        </div>
        <Badge variant={job.state === "failed" ? "destructive" : "secondary"}>
          {VIDEO_JOB_STATE_LABELS[job.state]}
        </Badge>
      </div>

      {isActiveJob(job) && (
        <div className="flex items-center gap-2">
          <Progress value={job.progress} className="flex-1" />
          <span className="w-10 text-right text-xs tabular-nums">{job.progress}%</span>
          <Button variant="ghost" size="sm" disabled={cancelling} onClick={cancel}>
            <X /> Cancelar
          </Button>
        </div>
      )}

      {job.tool === "apply" && job.state === "processing" && (
        <p className="text-xs text-muted-foreground">
          Fotogramas processados: {job.frames_processed ?? 0}
          {job.frame_count != null ? ` / ${job.frame_count}` : ""}
        </p>
      )}

      {job.state === "failed" && job.error && (
        <p className="text-xs text-destructive">{job.error.message}</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ panel

const PANEL_TITLES: Record<VideoToolPanel, string> = {
  trim: "Recortar",
  apply: "Aplicar ferramentas",
};

// The video tool opened from the toolbar, for the video in the carousel.
export function VideoToolsPanel() {
  const { video, panel, setPanel } = useCurrentVideo();
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const jobs = useGetVideoJobs(session.user._id, pid, session.token, !!video);
  const reopened = useRef<string | null>(null);

  // REQ-VID-JOB-010: back to a video with a request in progress, its tool
  // opens again, with the progress (once per visit, so it can be closed)
  useEffect(() => {
    if (!video) {
      reopened.current = null;
      return;
    }
    if (!jobs.data || reopened.current === video._id) return;
    reopened.current = video._id;
    const active = jobs.data.find((j) => j.video_id === video._id && isActiveJob(j));
    if (active && !panel) setPanel(active.tool);
  }, [video, jobs.data, panel, setPanel]);

  if (!video || !panel) return null;

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-r bg-background lg:w-96"
      aria-label={PANEL_TITLES[panel]}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{PANEL_TITLES[panel]}</h2>
          <p className="truncate text-xs text-muted-foreground" title={video.name}>
            {video.name}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Fechar ferramenta"
          onClick={() => setPanel(null)}
        >
          <X />
        </Button>
      </div>
      {/* keyed by video, so a tool started on one video does not carry over to the
          next, and by its file, so that the tool restarts once a result replaced it */}
      <div className="flex flex-col gap-6 overflow-y-auto p-3">
        <div key={`${video._id}:${video.size}:${video.duration}`}>
          {panel === "trim" ? <TrimPanel video={video} /> : <VideoApplyPanel video={video} />}
        </div>
        {/* outside the key above, to notice when the result replaced the video */}
        <CurrentJob key={video._id} video={video} />
      </div>
    </aside>
  );
}
