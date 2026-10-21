"use client";

// The video shown in the carousel, its player and the video tool panel that is
// open. Shared by the carousel (which plays the video), the toolbar (which
// opens a tool) and the tool panel (which reads and seeks the player).
// UC-VID-001 v1.5: also the interval selected for the trim, which is edited
// both on the tracks (handles) and in the trim panel (fields and slider).

import { createContext, useContext, useEffect, useState } from "react";
import { ProjectVideo } from "@/lib/videos";
import type { TrimMode } from "@/lib/video-jobs";

export type VideoToolPanel = "trim" | "apply";

export interface TrimSelection {
  start: number; // whole seconds (RN2)
  end: number;
  mode: TrimMode;
}

interface CurrentVideoContextData {
  video: ProjectVideo | null;
  setVideo: (video: ProjectVideo | null) => void;
  player: HTMLVideoElement | null;
  setPlayer: (player: HTMLVideoElement | null) => void;
  panel: VideoToolPanel | null;
  setPanel: (panel: VideoToolPanel | null) => void;
  trim: TrimSelection | null;
  setTrim: (trim: TrimSelection) => void;
}

const CurrentVideoContext = createContext<CurrentVideoContextData | undefined>(
  undefined,
);

// step 2: the selection starts as the whole video, to be kept
export function wholeVideo(video: ProjectVideo): TrimSelection {
  return { start: 0, end: Math.max(1, Math.ceil(video.duration ?? 0)), mode: "keep" };
}

export function CurrentVideoProvider({ children }: { children: React.ReactNode }) {
  const [video, setVideo] = useState<ProjectVideo | null>(null);
  const [player, setPlayer] = useState<HTMLVideoElement | null>(null);
  const [panel, setPanel] = useState<VideoToolPanel | null>(null);
  const [trim, setTrim] = useState<TrimSelection | null>(null);

  // leaving the video (to an image or to the grid) closes its tool panel
  useEffect(() => {
    if (!video) setPanel(null);
  }, [video]);

  // another video, or the same one replaced by a result: the selection restarts
  useEffect(() => {
    setTrim(video ? wholeVideo(video) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?._id, video?.size, video?.duration]);

  return (
    <CurrentVideoContext.Provider
      value={{ video, setVideo, player, setPlayer, panel, setPanel, trim, setTrim }}
    >
      {children}
    </CurrentVideoContext.Provider>
  );
}

export function useCurrentVideo() {
  const context = useContext(CurrentVideoContext);
  if (context === undefined) {
    throw new Error("useCurrentVideo() must be used within a CurrentVideoProvider");
  }
  return context;
}
