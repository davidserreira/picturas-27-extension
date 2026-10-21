"use client";

// The video shown in the carousel, its player and the video tool panel that is
// open. Shared by the carousel (which plays the video), the toolbar (which
// opens a tool) and the tool panel (which reads and seeks the player).

import { createContext, useContext, useEffect, useState } from "react";
import { ProjectVideo } from "@/lib/videos";

export type VideoToolPanel = "trim" | "apply";

interface CurrentVideoContextData {
  video: ProjectVideo | null;
  setVideo: (video: ProjectVideo | null) => void;
  player: HTMLVideoElement | null;
  setPlayer: (player: HTMLVideoElement | null) => void;
  panel: VideoToolPanel | null;
  setPanel: (panel: VideoToolPanel | null) => void;
}

const CurrentVideoContext = createContext<CurrentVideoContextData | undefined>(
  undefined,
);

export function CurrentVideoProvider({ children }: { children: React.ReactNode }) {
  const [video, setVideo] = useState<ProjectVideo | null>(null);
  const [player, setPlayer] = useState<HTMLVideoElement | null>(null);
  const [panel, setPanel] = useState<VideoToolPanel | null>(null);

  // leaving the video (to an image or to the grid) closes its tool panel
  useEffect(() => {
    if (!video) setPanel(null);
  }, [video]);

  return (
    <CurrentVideoContext.Provider
      value={{ video, setVideo, player, setPlayer, panel, setPanel }}
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
