// Video tools (UC-VID-001 trim / UC-VID-003 apply). Requests are processed in the
// background; their state comes by WebSocket ("video-job-update") and polling.

import { api } from "./axios";
import type { VideoApplyTool } from "./video-apply";

export type VideoJobState =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

interface VideoJobBase {
  _id: string;
  project_id: string;
  video_id: string;
  state: VideoJobState;
  progress: number;
  frames_processed: number;
  frame_count: number | null;
  error: { code: string; message: string } | null;
  result_name: string;
  result_video_id: string | null;
  createdAt: string;
  updatedAt: string;
  finished_at: string | null;
}

export type VideoJob = VideoJobBase & (
  | { tool: "trim"; params: { start: number; end: number } }
  | { tool: "apply"; params: { tools: VideoApplyTool[]; width: number; height: number } }
);

// REQ-011: the five states of a request, as shown to the user
export const VIDEO_JOB_STATE_LABELS: Record<VideoJobState, string> = {
  queued: "Em fila",
  processing: "Em processamento",
  completed: "Concluído",
  failed: "Falhado",
  cancelled: "Cancelado",
};

export const ACTIVE_JOB_STATES: VideoJobState[] = ["queued", "processing"];

export const isActiveJob = (job: VideoJob) => ACTIVE_JOB_STATES.includes(job.state);

// ------------------------------------------------------------------ interval

// "1:05" or "65" -> 65; null if it is not a valid whole number of seconds
export function parseTimecode(text: string): number | null {
  const value = text.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const long = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(value);
  if (long) return Number(long[1]) * 3600 + Number(long[2]) * 60 + Number(long[3]);
  return null;
}

// 65 -> "1:05", 3725 -> "1:02:05"
export function formatTimecode(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// RN2 / REQ-003 (same rules as the backend): reason why the interval is
// invalid, or null if it can be applied
export function trimIntervalError(
  start: number | null,
  end: number | null,
  duration: number,
): string | null {
  if (start === null || end === null)
    return "Indique o início e o fim em segundos (por exemplo 1:05).";
  if (start < 0) return "O início não pode ser negativo.";
  if (start >= end) return "O instante de fim tem de ser posterior ao de início.";
  if (end > Math.ceil(duration))
    return "O instante de fim não pode exceder a duração do vídeo.";
  if (end - start < 1) return "O recorte tem de ter pelo menos 1 segundo.";
  return null;
}

// ----------------------------------------------------------------------- api

interface JobsRequest {
  uid: string;
  pid: string;
  token: string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const trimVideo = async ({
  uid,
  pid,
  token,
  videoId,
  start,
  end,
}: JobsRequest & { videoId: string; start: number; end: number }) => {
  const response = await api.post<{ job: VideoJob }>(
    `/projects/${uid}/${pid}/videos/${videoId}/trim`,
    { start, end },
    { headers: authHeaders(token) },
  );
  return response.data.job;
};

export const fetchVideoJobs = async ({ uid, pid, token }: JobsRequest) => {
  const response = await api.get<{ jobs: VideoJob[] }>(
    `/projects/${uid}/${pid}/video-jobs`,
    { headers: authHeaders(token) },
  );
  return response.data.jobs;
};

export const applyVideoTools = async ({ uid, pid, token, videoId, tools }:
  JobsRequest & { videoId: string; tools: VideoApplyTool[] }) => {
  const response = await api.post<{ job: VideoJob }>(
    `/projects/${uid}/${pid}/videos/${videoId}/apply`, { tools },
    { headers: authHeaders(token) },
  );
  return response.data.job;
};

export const cancelVideoJob = async ({
  uid,
  pid,
  token,
  jobId,
}: JobsRequest & { jobId: string }) => {
  const response = await api.post<{ job: VideoJob }>(
    `/projects/${uid}/${pid}/video-jobs/${jobId}/cancel`,
    {},
    { headers: authHeaders(token) },
  );
  return response.data.job;
};

// REQ-021: "Exportar" saves the video file on the user's computer. The URL is
// fetched first because the browser ignores `download` on another origin.
export async function downloadVideo(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("download failed");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
