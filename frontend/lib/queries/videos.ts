import { useQuery } from "@tanstack/react-query";
import {
  fetchProjectVideos,
  fetchProjectVideoTracks,
  VideoLibrary,
  VideoTracks,
} from "../videos";

export const projectVideosKey = (uid: string, pid: string, token: string) => [
  "projectVideos",
  uid,
  pid,
  token,
];

export const useGetProjectVideos = (
  uid: string,
  pid: string,
  token: string,
  enabled: boolean = true,
) => {
  return useQuery<VideoLibrary>({
    queryKey: projectVideosKey(uid, pid, token),
    queryFn: () => fetchProjectVideos({ uid, pid, token }),
    enabled: enabled && !!uid && !!pid && !!token,
    // keep the states fresh while an import is going on
    refetchInterval: (query) => {
      const states = query.state.data?.videos.map((v) => v.state) ?? [];
      if (states.includes("uploading") || states.includes("validating"))
        return 3000;
      if (states.includes("interrupted")) return 15000;
      return false;
    },
  });
};

export const useGetVideoTracks = (
  uid: string,
  pid: string,
  token: string,
  videoId: string | undefined,
) => {
  return useQuery<VideoTracks>({
    queryKey: ["videoTracks", uid, pid, videoId],
    queryFn: () => fetchProjectVideoTracks({ uid, pid, token, videoId: videoId! }),
    enabled: !!uid && !!pid && !!token && !!videoId,
    // the tracks of a video never change
    staleTime: Infinity,
    retry: 1,
    // the waveforms are computed on the server the first time
    refetchInterval: (query) =>
      query.state.data?.state === "analyzing" ? 2000 : false,
  });
};
