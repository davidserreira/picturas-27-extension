"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Film, RotateCcw, Scissors, Trash, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useProjectInfo } from "@/providers/project-provider";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/hooks/use-toast";
import { projectVideosKey, useGetProjectVideos } from "@/lib/queries/videos";
import { useVideoJobUpdates } from "@/lib/queries/video-jobs";
import {
  useExportVideo,
  VideoDialogTab,
  VideoToolsDialog,
} from "./video-tools-dialog";
import {
  cancelVideoImportTask,
  dismissVideoImport,
  hasVideoImportFile,
  resumeVideoImportTask,
  setListedVideoProject,
  useVideoImports,
  VideoImportTask,
} from "@/lib/video-imports";
import {
  deleteProjectVideo,
  fetchProjectVideoUrl,
  formatBytes,
  formatDuration,
  getVideoErrorMessage,
  ProjectVideo,
  VIDEO_FILE_ACCEPT,
  VIDEO_STATE_LABELS,
  VideoState,
} from "@/lib/videos";

const TERMINAL_STATES: VideoState[] = ["available", "failed", "cancelled"];

// While this tab is sending the file it knows more than the last answer from
// the server (progress within a chunk, a lost connection, a cancel just asked).
function currentStatus(video: ProjectVideo, task?: VideoImportTask) {
  const serverStillImporting =
    video.state === "uploading" || video.state === "interrupted";

  if (task && serverStillImporting && task.state !== "failed")
    return { state: task.state, sent: task.sent };

  return { state: video.state, sent: video.received };
}

function useVideoUrl(video: ProjectVideo | null) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();

  return useQuery({
    queryKey: ["projectVideoUrl", session.user._id, pid, video?._id],
    queryFn: () =>
      fetchProjectVideoUrl({
        uid: session.user._id,
        pid,
        token: session.token,
        videoId: video!._id,
      }),
    enabled: !!video,
    // the url is signed for 1 h
    staleTime: 30 * 60 * 1000,
  });
}

// An available video: its first frame as thumbnail; plays muted, with a thin
// progress bar, while the mouse is over it.
function VideoTile({
  video,
  onOpen,
  onTools,
  onExport,
  onDelete,
}: {
  video: ProjectVideo;
  onOpen: () => void;
  onTools: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const url = useVideoUrl(video);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [unplayable, setUnplayable] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleEnter() {
    videoRef.current?.play().catch(() => {});
  }

  function handleLeave() {
    const element = videoRef.current;
    if (!element) return;
    element.pause();
    element.currentTime = 0.1;
    setProgress(0);
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          role="button"
          tabIndex={0}
          title={video.name}
          className="group relative overflow-hidden size-full cursor-pointer bg-black"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={() => {
            handleLeave();
            onOpen();
          }}
          onKeyDown={(e) => e.key === "Enter" && onOpen()}
        >
          {url.data && !unplayable ? (
            <video
              ref={videoRef}
              // start slightly in, so the thumbnail is not a black first frame
              src={`${url.data}#t=0.1`}
              muted
              loop
              playsInline
              preload="metadata"
              className="size-full object-contain transition-all group-hover:scale-105"
              onLoadedData={() => setLoaded(true)}
              onError={() => setUnplayable(true)}
              onTimeUpdate={(e) => {
                const { currentTime, duration } = e.currentTarget;
                if (duration > 0) setProgress((currentTime * 100) / duration);
              }}
            />
          ) : (
            <div className="size-full flex items-center justify-center text-muted-foreground">
              <Film className="size-10" />
            </div>
          )}

          {!loaded && !unplayable && !url.isError && (
            <Skeleton className="absolute inset-0" />
          )}

          <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            <Film className="size-3" />
            {video.duration != null && formatDuration(video.duration)}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-left">
            <p className="truncate text-xs font-medium text-white">
              {video.name}
            </p>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100">
            <div
              className="h-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem className="flex justify-between gap-4" onClick={onTools}>
          <span>Ferramentas de vídeo</span>
          <Scissors className="size-4" />
        </ContextMenuItem>
        <ContextMenuItem className="flex justify-between gap-4" onClick={onExport}>
          <span>Exportar</span>
          <Download className="size-4" />
        </ContextMenuItem>
        <ContextMenuItem className="flex justify-between" onClick={onDelete}>
          <span>Delete</span>
          <Trash className="size-4" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// A video that is not in the library (yet): being sent, validated, interrupted,
// or an import that failed or was cancelled.
function ImportTile({
  video,
  state,
  sent,
  busy,
  onCancel,
  onResume,
  onRemove,
}: {
  video: ProjectVideo;
  state: VideoState;
  sent: number;
  busy: boolean;
  onCancel: () => void;
  onResume: () => void;
  onRemove: () => void;
}) {
  const percent = Math.min(100, Math.floor((sent * 100) / video.size));

  return (
    <Card className="size-full flex flex-col items-center justify-center gap-2 p-3 text-center overflow-hidden">
      <Film className="size-8 shrink-0 text-muted-foreground" />
      <p className="w-full truncate text-sm font-medium" title={video.name}>
        {video.name}
      </p>
      <Badge variant={state === "failed" ? "destructive" : "secondary"}>
        {VIDEO_STATE_LABELS[state]}
      </Badge>

      {(state === "uploading" || state === "interrupted") && (
        <Progress value={percent} className="w-full" />
      )}

      <p
        className={`w-full text-xs line-clamp-3 ${
          state === "failed" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {state === "uploading" &&
          `${percent}% · ${formatBytes(sent)} de ${formatBytes(video.size)}`}
        {state === "validating" &&
          "A verificar o formato, o codec e a duração"}
        {state === "interrupted" &&
          `O envio parou aos ${percent}%.${
            video.expiresAt
              ? ` Pode retomá-lo até às ${new Date(
                  video.expiresAt,
                ).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : ""
          }`}
        {state === "failed" && (video.reason ?? "A importação falhou.")}
        {state === "cancelled" && "Nada foi guardado."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1">
        {state === "interrupted" && (
          <Button variant="outline" size="sm" disabled={busy} onClick={onResume}>
            <RotateCcw /> Retomar
          </Button>
        )}
        {TERMINAL_STATES.includes(state) ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
            <Trash /> Remover
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            <X /> Cancelar
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * The project's videos, as tiles for the same grid the images are in.
 * Renders the tiles as siblings (no wrapper), so it goes inside the grid.
 */
export function ProjectVideoTiles() {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const anonymous = session.user.type === "anonymous";

  const uid = session.user._id;
  const token = session.token;
  const library = useGetProjectVideos(uid, pid, token, !anonymous);
  const tasks = useVideoImports().filter((t) => t.pid === pid);

  const [playing, setPlaying] = useState<ProjectVideo | null>(null);
  const [dialogTab, setDialogTab] = useState<VideoDialogTab>("view");
  const { exportVideo } = useExportVideo();
  // UC-VID-001: real-time state of the video tool requests
  useVideoJobUpdates(uid, pid, token);
  const [toDelete, setToDelete] = useState<ProjectVideo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const resumeTargetRef = useRef<string | null>(null);

  const listed = !anonymous && (library.data?.videos.length ?? 0) > 0;
  useEffect(() => {
    if (!listed) return;
    setListedVideoProject(pid);
    return () => setListedVideoProject(null);
  }, [listed, pid]);

  // A local import changing state means the list on the server changed too.
  const taskStates = tasks.map((t) => `${t.id}:${t.state}`).join(",");
  useEffect(() => {
    if (!taskStates) return;
    qc.invalidateQueries({ queryKey: projectVideosKey(uid, pid, token) });
  }, [taskStates, qc, uid, pid, token]);

  // Once the server also shows an import as finished, the tab can forget it.
  const finishedOnServer = (library.data?.videos ?? [])
    .filter((v) => TERMINAL_STATES.includes(v.state))
    .map((v) => v._id)
    .join(",");
  useEffect(() => {
    if (!taskStates || !library.isSuccess) return;
    const finished = finishedOnServer.split(",");
    for (const entry of taskStates.split(",")) {
      const [id, state] = entry.split(":");
      if (TERMINAL_STATES.includes(state as VideoState) && finished.includes(id))
        dismissVideoImport(id);
    }
  }, [taskStates, finishedOnServer, library.isSuccess]);

  if (anonymous || !library.data || library.data.videos.length === 0)
    return null;

  const { videos } = library.data;
  const request = { uid, pid, token };

  function refresh() {
    qc.invalidateQueries({ queryKey: projectVideosKey(uid, pid, token) });
  }

  function showError(title: string, error: unknown) {
    toast({
      title,
      description: getVideoErrorMessage(error),
      variant: "destructive",
    });
  }

  async function handleCancel(video: ProjectVideo) {
    setBusy(video._id);
    try {
      await cancelVideoImportTask({ ...request, videoId: video._id });
      toast({ title: "Importação cancelada" });
    } catch (error) {
      showError("Não foi possível cancelar a importação", error);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function resume(videoId: string, file?: File) {
    setBusy(videoId);
    try {
      await resumeVideoImportTask({ ...request, videoId, file });
    } catch (error) {
      showError("Não foi possível retomar a importação", error);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  function handleResume(video: ProjectVideo) {
    if (hasVideoImportFile(video._id)) {
      resume(video._id);
      return;
    }
    // this tab no longer has the file: ask for the same one again
    resumeTargetRef.current = video._id;
    resumeInputRef.current?.click();
  }

  function handleResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const videoId = resumeTargetRef.current;
    resumeTargetRef.current = null;
    if (file && videoId) resume(videoId, file);
  }

  async function handleDelete(video: ProjectVideo) {
    setBusy(video._id);
    try {
      await deleteProjectVideo({ ...request, videoId: video._id });
      dismissVideoImport(video._id);
    } catch (error) {
      showError("Não foi possível remover o vídeo", error);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  return (
    <>
      {videos.map((video) => {
        const { state, sent } = currentStatus(
          video,
          tasks.find((t) => t.id === video._id),
        );

        return (
          <div key={video._id} className="aspect-square">
            {state === "available" ? (
              <VideoTile
                video={video}
                onOpen={() => {
                  setDialogTab("view");
                  setPlaying(video);
                }}
                onTools={() => {
                  setDialogTab("tools");
                  setPlaying(video);
                }}
                onExport={() => exportVideo(video._id, video.name)}
                onDelete={() => setToDelete(video)}
              />
            ) : (
              <ImportTile
                video={video}
                state={state}
                sent={sent}
                busy={busy === video._id}
                onCancel={() => handleCancel(video)}
                onResume={() => handleResume(video)}
                onRemove={() => handleDelete(video)}
              />
            )}
          </div>
        );
      })}

      <input
        ref={resumeInputRef}
        type="file"
        accept={VIDEO_FILE_ACCEPT}
        className="hidden"
        onChange={handleResumeFile}
      />

      <VideoToolsDialog
        video={playing}
        tab={dialogTab}
        onTabChange={setDialogTab}
        onClose={() => setPlaying(null)}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{toDelete?.name}&quot; will be removed from the project.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) handleDelete(toDelete);
                setToDelete(null);
              }}
            >
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
