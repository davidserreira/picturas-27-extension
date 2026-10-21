"use client";

// UC-VID-001 / UC-VID-003 — Recortar, aplicar ferramentas e exportar.
// Panel docked next to the toolbar while a video is open in the carousel:
// the tool chosen in the toolbar (Trim / Apply) + the requests of this video.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Download, LoaderCircle, Play, Scissors, X } from "lucide-react";
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
  trimIntervalError,
  trimVideo,
  VIDEO_JOB_STATE_LABELS,
  VideoJob,
} from "@/lib/video-jobs";

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
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  // the player of the carousel, where the video is being watched
  const { player } = useCurrentVideo();

  const duration = video.duration ?? 0;
  const maxEnd = Math.max(1, Math.ceil(duration));

  // the interval starts as the whole video (step 2)
  const [startText, setStartText] = useState("0:00");
  const [endText, setEndText] = useState(formatTimecode(maxEnd));
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const start = parseTimecode(startText);
  const end = parseTimecode(endText);
  // E4 / REQ-003: validated while the user types
  const invalid = trimIntervalError(start, end, duration);

  const isFree = session.user.type === "free";
  const remaining = session.user.remaining_operations;
  const noOperations = isFree && remaining != null && remaining <= 0;

  function setFromSlider([s, e]: number[]) {
    setStartText(formatTimecode(s));
    setEndText(formatTimecode(e));
    if (player) player.currentTime = s;
  }

  function takeCurrentTime(which: "start" | "end") {
    const t = Math.round(player?.currentTime ?? 0);
    if (which === "start") setStartText(formatTimecode(t));
    else setEndText(formatTimecode(t));
  }

  // plays only the chosen interval, without processing anything
  function preview() {
    if (!player || invalid || start === null) return;
    player.currentTime = start;
    setPreviewing(true);
    player.play().catch(() => setPreviewing(false));
  }

  useEffect(() => {
    if (!player || !previewing || end === null) return;
    const stopAtEnd = () => {
      if (player.currentTime >= end) {
        player.pause();
        setPreviewing(false);
      }
    };
    player.addEventListener("timeupdate", stopAtEnd);
    return () => player.removeEventListener("timeupdate", stopAtEnd);
  }, [player, previewing, end]);

  async function apply() {
    if (invalid || start === null || end === null) return;
    setSubmitting(true);
    try {
      const job = await trimVideo({
        uid: session.user._id,
        pid,
        token: session.token,
        videoId: video._id,
        start,
        end,
      });
      // REQ-009: confirm the request was received
      toast({
        title: "Pedido de recorte recebido",
        description: "Quando terminar, o vídeo é substituído pelo recorte. Pode acompanhar o progresso abaixo ou sair desta página.",
      });
      qc.setQueryData<VideoJob[]>(
        videoJobsKey(session.user._id, pid, session.token),
        (jobs) => [job, ...(jobs ?? []).filter((j) => j._id !== job._id)],
      );
    } catch (error) {
      // E1, E2, E3, E6: the backend explains why
      toast({
        title: "Não foi possível recortar o vídeo",
        description: getVideoErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const sliderValue = [
    Math.min(start ?? 0, maxEnd),
    Math.min(end ?? maxEnd, maxEnd),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Duração total: {formatTimecode(duration)}</span>
          {!invalid && start !== null && end !== null && (
            <span className="font-medium text-foreground">
              Duração do recorte: {formatTimecode(Math.min(end, duration) - start)}
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
          aria-label="Intervalo do recorte"
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
            <SliderPrimitive.Range className="absolute h-full bg-primary" />
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
            ["start", "Início", startText, setStartText],
            ["end", "Fim", endText, setEndText],
          ] as const
        ).map(([key, label, value, setValue]) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`trim-${key}`}>{label} (m:ss)</Label>
            <div className="flex gap-1">
              <Input
                id={`trim-${key}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
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
          <Button disabled={!!invalid || submitting || noOperations} onClick={apply}>
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

// --------------------------------------------------------------- requests

function JobRow({ job }: { job: VideoJob }) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { exportVideo, exporting } = useExportVideo();
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    setCancelling(true);
    try {
      const updated = await cancelVideoJob({
        uid: session.user._id,
        pid,
        token: session.token,
        jobId: job._id,
      });
      qc.setQueryData<VideoJob[]>(
        videoJobsKey(session.user._id, pid, session.token),
        (jobs) => jobs?.map((j) => (j._id === updated._id ? updated : j)),
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

  const variant =
    job.state === "failed" ? "destructive" : job.state === "completed" ? "default" : "secondary";

  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {job.tool === "trim" ? "Recortar" : "Aplicar ferramentas"}
          </p>
          <p className="text-xs text-muted-foreground">
            {job.tool === "trim"
              ? `Recorte ${formatTimecode(job.params.start)} – ${formatTimecode(job.params.end)}`
              : job.params.tools.map(applyToolDescription).join(" → ")}
          </p>
        </div>
        <Badge variant={variant}>{VIDEO_JOB_STATE_LABELS[job.state]}</Badge>
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

      {job.tool === "apply" && job.state !== "queued" && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Fotogramas processados: {job.frames_processed ?? 0}{job.frame_count != null ? ` / ${job.frame_count}` : ""}
        </p>
      )}

      {job.state === "failed" && job.error && (
        <p className="text-xs text-destructive">{job.error.message}</p>
      )}

      {job.state === "completed" && job.result_video_id && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting === job.result_video_id}
            onClick={() => exportVideo(job.result_video_id!, job.result_name)}
          >
            {exporting === job.result_video_id ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download />
            )}
            Exportar
          </Button>
        </div>
      )}
    </li>
  );
}

function JobsList({ video }: { video: ProjectVideo }) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const jobs = useGetVideoJobs(session.user._id, pid, session.token);

  const ofThisVideo = useMemo(
    () => (jobs.data ?? []).filter((j) => j.video_id === video._id).slice(0, 5),
    [jobs.data, video._id],
  );

  if (ofThisVideo.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Pedidos deste vídeo</h3>
      <ul className="flex flex-col gap-2">
        {ofThisVideo.map((job) => (
          <JobRow key={job._id} job={job} />
        ))}
      </ul>
    </div>
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
      <div key={`${video._id}:${video.size}:${video.duration}`} className="flex flex-col gap-6 overflow-y-auto p-3">
        {panel === "trim" ? <TrimPanel video={video} /> : <VideoApplyPanel video={video} />}
        <JobsList video={video} />
      </div>
    </aside>
  );
}
