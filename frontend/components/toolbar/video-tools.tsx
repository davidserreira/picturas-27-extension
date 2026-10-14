"use client";

// UC-VID-001 / UC-VID-003 — the toolbar while a video is open in the carousel.
// Each tool opens its panel next to the toolbar (VideoToolsPanel).

import { Download, LoaderCircle, Scissors, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useCurrentVideo, VideoToolPanel } from "@/providers/current-video-provider";
import { useExportVideo } from "../project-page/video-tools-panel";

function VideoToolButton({
  icon: Icon,
  label,
  active = false,
  busy = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "outline"}
          className="size-8"
          aria-pressed={active}
          disabled={busy}
          onClick={onClick}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="ml-2 bg-indigo-500" side="right">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function VideoTools() {
  const { video, panel, setPanel } = useCurrentVideo();
  const { exportVideo, exporting } = useExportVideo();
  if (!video) return null;

  const toggle = (tool: VideoToolPanel) => setPanel(panel === tool ? null : tool);

  return (
    <>
      <VideoToolButton
        icon={Scissors}
        label="Recortar"
        active={panel === "trim"}
        onClick={() => toggle("trim")}
      />
      <VideoToolButton
        icon={SlidersHorizontal}
        label="Aplicar ferramentas"
        active={panel === "apply"}
        onClick={() => toggle("apply")}
      />
      <VideoToolButton
        icon={Download}
        label="Exportar"
        busy={exporting === video._id}
        onClick={() => exportVideo(video._id, video.name)}
      />
    </>
  );
}
