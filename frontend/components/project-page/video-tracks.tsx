"use client";

// Audio and video tracks of a video of the library, on a timeline under the
// player: a strip of frames for each video track and the waveform of each
// audio track, with the playback position. Clicking the tracks seeks, the
// playhead can be dragged, and the timeline can be zoomed in and scrolled.
// UC-VID-001 v1.5: while the Recortar panel is open (toolbar, on the left),
// the interval to keep or to remove is also selected here, by dragging its two
// ends over the video and audio tracks. The controls are only in the panel.

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Film, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useProjectInfo } from "@/providers/project-provider";
import { TrimSelection, useCurrentVideo } from "@/providers/current-video-provider";
import { formatTimecode } from "@/lib/video-jobs";
import { useSession } from "@/providers/session-provider";
import { useGetVideoTracks } from "@/lib/queries/videos";
import {
  AudioStreamTrack,
  formatDuration,
  getVideoErrorMessage,
  ProjectVideo,
  VideoStreamTrack,
} from "@/lib/videos";

const CODEC_NAMES: Record<string, string> = {
  h264: "H.264",
  hevc: "H.265",
  prores: "ProRes",
  mjpeg: "Motion JPEG",
  png: "PNG",
  aac: "AAC",
  mp3: "MP3",
  ac3: "AC-3",
  eac3: "E-AC-3",
  opus: "Opus",
  alac: "ALAC",
  flac: "FLAC",
};

function codecName(codec: string | null) {
  if (!codec) return "Codec desconhecido";
  if (codec.startsWith("pcm_")) return "PCM";
  return CODEC_NAMES[codec] ?? codec.toUpperCase();
}

function decimal(value: number, digits = 2) {
  return value.toLocaleString("pt-PT", { maximumFractionDigits: digits });
}

function channelsLabel(channels: number | null) {
  if (channels === 1) return "mono";
  if (channels === 2) return "estéreo";
  if (channels === 6) return "5.1";
  if (channels === 8) return "7.1";
  return channels ? `${channels} canais` : null;
}

function videoDetails(track: VideoStreamTrack) {
  return [
    codecName(track.codec),
    track.width && track.height ? `${track.width} × ${track.height}` : null,
    track.fps ? `${decimal(track.fps)} fps` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function audioDetails(track: AudioStreamTrack) {
  return [
    codecName(track.codec),
    channelsLabel(track.channels),
    track.sample_rate ? `${decimal(track.sample_rate / 1000, 1)} kHz` : null,
    track.language?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(" · ");
}

// Interval between the marks of the ruler, so that at most 8 are in view.
function rulerStep(visibleDuration: number) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return steps.find((s) => visibleDuration / s <= 8) ?? 600;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const LANE_HEIGHT = 48;
const MAX_FRAMES = 120;
// A press this close to the playhead (px) grabs it instead of jumping.
const GRAB_DISTANCE = 10;
// The most the timeline zooms in: this many seconds fill the view.
const MIN_SECONDS_IN_VIEW = 5;
const MAX_ZOOM = 100;
const ZOOM_STEP = 1.5;

// Frames spread over the duration, read with a hidden player of the same
// file (seek, then draw) and drawn as they arrive. More frames as the
// timeline gets wider, once the zoom stops changing.
const FrameStrip = memo(function FrameStrip({
  url,
  duration,
  track,
}: {
  url: string;
  duration: number;
  track: VideoStreamTrack;
}) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const settledWidth = useDebounced(width, 300);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  const aspect =
    track.width && track.height ? track.width / track.height : 16 / 9;
  const count =
    settledWidth > 0
      ? Math.max(1, Math.min(MAX_FRAMES, Math.ceil(settledWidth / (LANE_HEIGHT * aspect))))
      : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || count === 0 || duration <= 0) return;

    // drawn at the screen's pixel density, so that the frames stay sharp
    const frameH = Math.round(LANE_HEIGHT * Math.min(2, window.devicePixelRatio || 1));
    const frameW = Math.round(frameH * aspect);
    canvas.width = frameW * count;
    canvas.height = frameH;

    let stopped = false;
    const player = document.createElement("video");
    player.muted = true;
    player.preload = "auto";
    player.playsInline = true;
    player.src = url;

    const seek = (time: number) =>
      new Promise<void>((resolve, reject) => {
        player.onseeked = () => resolve();
        player.onerror = () => reject(new Error("unreadable"));
        player.currentTime = time;
      });

    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          player.onloadeddata = () => resolve();
          player.onerror = () => reject(new Error("unreadable"));
        });
        for (let i = 0; i < count && !stopped; i++) {
          // middle of each slice of the timeline
          await seek(Math.min(duration - 0.05, ((i + 0.5) * duration) / count));
          if (stopped) break;
          context.drawImage(player, i * frameW, 0, frameW, frameH);
        }
      } catch {
        if (!stopped) setFailed(true);
      }
    })();

    return () => {
      stopped = true;
      player.removeAttribute("src");
      player.load();
    };
  }, [url, duration, count, aspect]);

  return (
    <div ref={containerRef} className="relative size-full overflow-hidden bg-muted">
      <canvas ref={canvasRef} className="size-full" />
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Não foi possível mostrar os fotogramas
        </span>
      )}
    </div>
  );
});

// Mirrored waveform: the loudest sample of each slice, scaled to the
// loudest of the track, as wide as the track is long.
const Waveform = memo(function Waveform({
  track,
  duration,
  analysing,
  failed,
}: {
  track: AudioStreamTrack;
  duration: number;
  analysing: boolean;
  failed: boolean;
}) {
  const shape = useMemo(() => {
    const peaks = track.peaks;
    if (!peaks || peaks.length === 0) return null;
    const max = peaks.reduce((a, b) => Math.max(a, b), 0);
    if (max === 0) return "silent";
    const height = (p: number) => Math.max(0.5, (p / max) * 48);
    const top = peaks.map((p, i) => `${i},${50 - height(p)}`);
    const bottom = peaks
      .map((p, i) => `${i + 1},${50 + height(p)}`)
      .reverse();
    return { points: [...top, ...bottom].join(" "), length: peaks.length };
  }, [track.peaks]);

  if (!shape) {
    if (analysing)
      return (
        <div className="relative size-full">
          <Skeleton className="size-full rounded-none" />
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            A analisar o áudio…
          </span>
        </div>
      );
    return (
      <div className="size-full flex items-center justify-center bg-muted text-xs text-muted-foreground">
        {failed ? "Não foi possível obter a forma de onda" : "Sem forma de onda"}
      </div>
    );
  }

  const trackDuration = track.peaks_duration ?? track.duration ?? duration;
  const widthPercent = Math.min(100, (trackDuration * 100) / duration);

  return (
    <div className="relative size-full bg-muted">
      {shape === "silent" ? (
        <div
          className="absolute inset-y-0 left-0 flex items-center"
          style={{ width: `${widthPercent}%` }}
        >
          <div className="h-px w-full bg-primary/60" />
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${shape.length} 100`}
          preserveAspectRatio="none"
          className="absolute inset-y-0 left-0 h-full text-primary"
          style={{ width: `${widthPercent}%` }}
          aria-hidden
        >
          <polygon points={shape.points} fill="currentColor" fillOpacity={0.75} />
        </svg>
      )}
    </div>
  );
});

// Moves on its own (no React render per frame) while the video plays, and
// scrolls the timeline so that it stays in view during playback.
function Playhead({
  player,
  duration,
  scrollerRef,
}: {
  player: HTMLVideoElement | null;
  duration: number;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!player || duration <= 0) return;
    let frame = 0;
    const update = () => {
      const ratio = Math.min(1, player.currentTime / duration);
      if (ref.current) ref.current.style.left = `${ratio * 100}%`;

      const scroller = scrollerRef.current;
      if (scroller && !player.paused && scroller.scrollWidth > scroller.clientWidth) {
        const x = ratio * scroller.scrollWidth;
        const margin = 24;
        if (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - margin)
          scroller.scrollLeft = x - margin;
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [player, duration, scrollerRef]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-y-0 z-10 w-0 -translate-x-1/2"
      style={{ left: 0 }}
      aria-hidden
    >
      {/* the handle, on the ruler */}
      <div className="absolute top-0 left-1/2 h-4 w-3 -translate-x-1/2 rounded-b-sm bg-destructive shadow" />
      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-destructive" />
    </div>
  );
}

// The selection of the trim over the video and audio tracks (not the ruler).
// Keep: what is outside it is dimmed. Remove: the selection is struck out.
// Its two ends are dragged (or moved with the arrows) in whole seconds (RN2).
function TrimOverlay({
  trim,
  duration,
  onHandleDown,
  onHandleMove,
  onHandleUp,
  onHandleKey,
}: {
  trim: TrimSelection;
  duration: number;
  onHandleDown: (which: "start" | "end", e: React.PointerEvent<HTMLDivElement>) => void;
  onHandleMove: (which: "start" | "end", e: React.PointerEvent<HTMLDivElement>) => void;
  onHandleUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHandleKey: (which: "start" | "end", e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const percent = (t: number) => (Math.min(t, duration) * 100) / (duration || 1);
  const left = percent(trim.start);
  const right = percent(trim.end);
  const remove = trim.mode === "remove";
  const color = remove ? "bg-destructive" : "bg-primary";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1 top-5 z-20" aria-hidden={false}>
      {remove ? (
        <div
          className="absolute inset-y-0 border-y-2 border-destructive bg-destructive/30"
          style={{
            left: `${left}%`,
            width: `${right - left}%`,
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0 6px, hsl(var(--destructive) / 0.35) 6px 8px)",
          }}
        />
      ) : (
        <>
          <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: `${left}%` }} />
          <div className="absolute inset-y-0 right-0 bg-background/70" style={{ width: `${100 - right}%` }} />
          <div
            className="absolute inset-y-0 border-y-2 border-primary"
            style={{ left: `${left}%`, width: `${right - left}%` }}
          />
        </>
      )}
      {(
        [
          ["start", left, "Início da seleção", trim.start],
          ["end", right, "Fim da seleção", trim.end],
        ] as const
      ).map(([which, position, label, value]) => (
        <div
          key={which}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.ceil(duration)}
          aria-valuenow={value}
          aria-valuetext={formatTimecode(value)}
          title={`${label}: arraste ou use as setas`}
          className={`pointer-events-auto absolute inset-y-0 flex w-3 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-sm shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${color}`}
          style={{ left: `${position}%` }}
          onPointerDown={(e) => onHandleDown(which, e)}
          onPointerMove={(e) => onHandleMove(which, e)}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={(e) => onHandleKey(which, e)}
        >
          <span className="h-4 w-0.5 rounded bg-white/80" />
          <span
            className={`absolute -top-5 whitespace-nowrap rounded px-1 text-[10px] font-medium tabular-nums text-white ${color} ${which === "start" ? "left-0" : "right-0"}`}
          >
            {formatTimecode(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrackLabel({
  name,
  icon,
  details,
}: {
  name: string;
  icon: React.ReactNode;
  details: string;
}) {
  return (
    <div className="flex h-12 items-center gap-2 bg-muted/60 px-2" title={details}>
      <span className="inline-flex items-center gap-1 text-xs font-semibold">
        {icon}
        {name}
      </span>
      <span className="truncate text-xs text-muted-foreground">{details}</span>
    </div>
  );
}

export function VideoTracks({
  video,
  url,
  player,
}: {
  video: ProjectVideo;
  url: string | undefined;
  player: HTMLVideoElement | null;
}) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const tracks = useGetVideoTracks(
    session.user._id,
    pid,
    session.token,
    video._id,
  );
  const { panel, trim, setTrim } = useCurrentVideo();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // set while the playhead is being dragged: the distance (px) between the
  // pointer and the playhead when it was grabbed
  const dragOffset = useRef<number | null>(null);
  // where the timeline must stay put while the zoom changes
  const zoomAnchor = useRef<{ time: number; x: number } | null>(null);

  const duration = tracks.data?.duration ?? video.duration ?? 0;
  const videoTracks = (tracks.data?.tracks ?? []).filter(
    (t): t is VideoStreamTrack => t.type === "video",
  );
  const audioTracks = (tracks.data?.tracks ?? []).filter(
    (t): t is AudioStreamTrack => t.type === "audio",
  );

  const maxZoom = Math.max(1, Math.min(MAX_ZOOM, duration / MIN_SECONDS_IN_VIEW));
  const [zoom, setZoom] = useState(1);

  const step = rulerStep(duration / zoom);
  const marks: number[] = [];
  for (let t = 0; t <= duration; t += step) marks.push(t);

  // The time under the playhead (or under the pointer) keeps its place in
  // the view while the zoom changes.
  function changeZoom(next: number, anchor?: { time: number; x: number }) {
    const scroller = scrollerRef.current;
    const clamped = Math.min(maxZoom, Math.max(1, next));
    if (!scroller || duration <= 0 || clamped === zoom) return;

    if (anchor) {
      zoomAnchor.current = anchor;
    } else {
      const time = player?.currentTime ?? 0;
      let x = (time / duration) * scroller.scrollWidth - scroller.scrollLeft;
      if (x < 0 || x > scroller.clientWidth) x = scroller.clientWidth / 2;
      zoomAnchor.current = { time, x };
    }
    setZoom(clamped);
  }

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const anchor = zoomAnchor.current;
    if (!scroller || !anchor || duration <= 0) return;
    scroller.scrollLeft = (anchor.time / duration) * scroller.scrollWidth - anchor.x;
    zoomAnchor.current = null;
  }, [zoom, duration]);

  // Ctrl + wheel zooms around the pointer (the page must not zoom instead).
  const changeZoomRef = useRef(changeZoom);
  changeZoomRef.current = changeZoom;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || duration <= 0) return;
      e.preventDefault();
      const rect = scroller.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = ((scroller.scrollLeft + x) / scroller.scrollWidth) * duration;
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      changeZoomRef.current(zoomRef.current * factor, { time, x });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [duration, tracks.isError]);

  function timeAt(clientX: number) {
    const content = contentRef.current;
    if (!content || duration <= 0) return 0;
    const { left, width } = content.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - left) / width)) * duration;
  }

  function playheadX() {
    const content = contentRef.current;
    if (!content || !player || duration <= 0) return null;
    const { left, width } = content.getBoundingClientRect();
    return left + Math.min(1, player.currentTime / duration) * width;
  }

  function seek(time: number) {
    if (player) player.currentTime = Math.min(duration, Math.max(0, time));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!player || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const x = playheadX();
    const distance = x === null ? Infinity : e.clientX - x;
    if (Math.abs(distance) <= GRAB_DISTANCE) {
      // grabbed the playhead: it moves with the pointer, without jumping
      dragOffset.current = distance;
    } else {
      dragOffset.current = 0;
      seek(timeAt(e.clientX));
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragOffset.current !== null && e.currentTarget.hasPointerCapture(e.pointerId)) {
      seek(timeAt(e.clientX - dragOffset.current));
      return;
    }
    // near the playhead, the pointer shows that it can be dragged
    const x = playheadX();
    e.currentTarget.style.cursor =
      x !== null && Math.abs(e.clientX - x) <= GRAB_DISTANCE ? "ew-resize" : "pointer";
  }

  function onPointerUp() {
    dragOffset.current = null;
  }

  const zoomSteps = Math.log(maxZoom);

  // ------------------------------------------------------------- trim
  const trimming = panel === "trim" && trim !== null;
  const maxEnd = Math.max(1, Math.ceil(duration));

  // an end never passes the other: at least 1 s stays selected
  function moveEnd(which: "start" | "end", time: number) {
    if (!trim) return;
    const t = Math.round(time);
    const next =
      which === "start"
        ? { ...trim, start: Math.min(Math.max(0, t), trim.end - 1) }
        : { ...trim, end: Math.max(Math.min(maxEnd, t), trim.start + 1) };
    if (next.start !== trim.start || next.end !== trim.end) setTrim(next);
    // the player shows the frame where the end is
    seek(which === "start" ? next.start : next.end);
  }

  function onHandleDown(which: "start" | "end", e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.stopPropagation(); // not a seek of the timeline
    e.currentTarget.setPointerCapture(e.pointerId);
    moveEnd(which, timeAt(e.clientX));
  }

  function onHandleMove(which: "start" | "end", e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) moveEnd(which, timeAt(e.clientX));
  }

  function onHandleUp(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  function onHandleKey(which: "start" | "end", e: React.KeyboardEvent<HTMLDivElement>) {
    if (!trim || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    moveEnd(which, (which === "start" ? trim.start : trim.end) + delta);
  }

  return (
    <section
      className="flex shrink-0 flex-col border-t bg-background"
      aria-label="Faixas do vídeo"
      // dragging on the tracks seeks the video, it does not change slide
      data-video-tracks
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Faixas</h2>
          <p className="truncate text-xs text-muted-foreground" title={video.name}>
            {video.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1" aria-label="Escala das faixas">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Diminuir a escala"
            disabled={zoom <= 1}
            onClick={() => changeZoom(zoom / ZOOM_STEP)}
          >
            <ZoomOut />
          </Button>
          <Slider
            className="w-24 sm:w-36"
            min={0}
            max={zoomSteps || 1}
            step={0.01}
            value={[Math.log(zoom)]}
            disabled={maxZoom <= 1}
            onValueChange={([value]) => changeZoom(Math.exp(value))}
            aria-label="Escala das faixas"
            title="Escala das faixas (também Ctrl + roda do rato)"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Aumentar a escala"
            disabled={zoom >= maxZoom}
            onClick={() => changeZoom(zoom * ZOOM_STEP)}
          >
            <ZoomIn />
          </Button>
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {decimal(zoom, 1)}×
          </span>
        </div>
      </div>

      <div className="p-3">
        {tracks.isError ? (
          <p className="text-sm text-destructive">
            {getVideoErrorMessage(tracks.error)}
          </p>
        ) : (
          <div className="flex rounded-md border">
            {/* labels */}
            <div className="flex w-[clamp(7rem,30%,14rem)] shrink-0 flex-col gap-1 border-r pb-1">
              <div className="h-5 border-b bg-muted/60" />
              {tracks.isLoading ? (
                <>
                  <Skeleton className="h-12 rounded-none" />
                  <Skeleton className="h-12 rounded-none" />
                </>
              ) : (
                <>
                  {videoTracks.map((t) => (
                    <TrackLabel
                      key={t.index}
                      name={`V${t.number}`}
                      icon={<Film className="size-3.5" />}
                      details={videoDetails(t)}
                    />
                  ))}
                  {audioTracks.map((t) => (
                    <TrackLabel
                      key={t.index}
                      name={`A${t.number}`}
                      icon={<AudioLines className="size-3.5" />}
                      details={audioDetails(t)}
                    />
                  ))}
                  {audioTracks.length === 0 && (
                    <TrackLabel
                      name="A"
                      icon={<VolumeX className="size-3.5" />}
                      details="—"
                    />
                  )}
                </>
              )}
            </div>

            {/* timeline, scrolled sideways when zoomed in */}
            <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto">
              <div
                ref={contentRef}
                tabIndex={0}
                aria-label="Posição de reprodução: clique, arraste o marcador ou use as setas"
                className="relative flex cursor-pointer select-none flex-col gap-1 pb-1 touch-none"
                style={{ width: `${zoom * 100}%` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => {
                  if (!player) return;
                  if (e.key === "ArrowRight") seek(player.currentTime + 1);
                  if (e.key === "ArrowLeft") seek(player.currentTime - 1);
                  if (e.key === "+") changeZoom(zoom * ZOOM_STEP);
                  if (e.key === "-") changeZoom(zoom / ZOOM_STEP);
                }}
              >
                {/* ruler */}
                <div className="relative h-5 border-b bg-muted/30 text-[10px] text-muted-foreground">
                  {marks.map((t) => (
                    <span
                      key={t}
                      className="absolute top-0 h-full border-l pl-0.5"
                      style={{ left: `${(t * 100) / (duration || 1)}%` }}
                    >
                      {t < duration - step / 2 ? formatDuration(t) : ""}
                    </span>
                  ))}
                </div>

                {tracks.isLoading ? (
                  <>
                    <Skeleton className="h-12 rounded-none" />
                    <Skeleton className="h-12 rounded-none" />
                  </>
                ) : (
                  <>
                    {videoTracks.map((t) => (
                      <div key={t.index} className="h-12">
                        {url && duration > 0 ? (
                          <FrameStrip url={url} duration={duration} track={t} />
                        ) : (
                          <Skeleton className="size-full rounded-none" />
                        )}
                      </div>
                    ))}
                    {audioTracks.map((t) => (
                      <div key={t.index} className="h-12">
                        <Waveform
                          track={t}
                          duration={duration}
                          analysing={tracks.data?.state === "analyzing"}
                          failed={tracks.data?.state === "failed"}
                        />
                      </div>
                    ))}
                    {audioTracks.length === 0 && (
                      <div className="h-12 flex items-center justify-center bg-muted text-xs text-muted-foreground">
                        Sem faixa de áudio
                      </div>
                    )}
                  </>
                )}
                {tracks.data && (
                  <Playhead player={player} duration={duration} scrollerRef={scrollerRef} />
                )}
                {tracks.data && trimming && trim && duration > 0 && (
                  <TrimOverlay
                    trim={trim}
                    duration={duration}
                    onHandleDown={onHandleDown}
                    onHandleMove={onHandleMove}
                    onHandleUp={onHandleUp}
                    onHandleKey={onHandleKey}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
