import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideoJobs, isActiveJob, VideoJob } from "../video-jobs";
import { projectVideosKey } from "./videos";
import { useGetSocket } from "./projects";
import { useUpdateSession } from "../mutations/session";

export const videoJobsKey = (uid: string, pid: string, token: string) => [
  "videoJobs",
  uid,
  pid,
  token,
];

export const useGetVideoJobs = (
  uid: string,
  pid: string,
  token: string,
  enabled: boolean = true,
) => {
  return useQuery<VideoJob[]>({
    queryKey: videoJobsKey(uid, pid, token),
    queryFn: () => fetchVideoJobs({ uid, pid, token }),
    enabled: enabled && !!uid && !!pid && !!token,
    // fallback to the WebSocket: while a request is active, ask every 3 s
    // (RN6 asks for progress at least every 5 s)
    refetchInterval: (query) =>
      (query.state.data ?? []).some(isActiveJob) ? 3000 : false,
  });
};

/**
 * Applies the "video-job-update" events sent by wsGateway (REQ-011/012).
 * When a request ends, the video library and the remaining daily operations
 * are refreshed too.
 */
export const useVideoJobUpdates = (uid: string, pid: string, token: string) => {
  const qc = useQueryClient();
  const socket = useGetSocket(token);
  const updateSession = useUpdateSession();

  useEffect(() => {
    const s = socket.data;
    if (!s) return;

    function onUpdate(job: VideoJob) {
      if (job.project_id !== pid) return;

      qc.setQueryData<VideoJob[]>(videoJobsKey(uid, pid, token), (jobs) => {
        if (!jobs) return jobs;
        const others = jobs.filter((j) => j._id !== job._id);
        return [job, ...others].sort((a, b) => (a._id < b._id ? 1 : -1));
      });

      if (!isActiveJob(job)) {
        qc.invalidateQueries({ queryKey: projectVideosKey(uid, pid, token) });
        updateSession.mutate({ userId: uid, token });
      }
    }

    s.on("video-job-update", onUpdate);
    return () => {
      s.off("video-job-update", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.data, uid, pid, token, qc]);
};
