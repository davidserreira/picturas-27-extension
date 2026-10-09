import axios from "axios";
import { api } from "./axios";

export type VideoState =
  | "uploading"
  | "validating"
  | "available"
  | "interrupted"
  | "failed"
  | "cancelled";

export interface ProjectVideo {
  _id: string;
  name: string;
  size: number;
  received: number;
  state: VideoState;
  reason: string | null;
  format: "mp4" | "mov" | null;
  codec: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  frame_count?: number | null;
  fps?: number | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface VideoLimits {
  maxSize: number;
  maxDuration: number;
  storage: number;
  maxActiveImports: number;
}

export interface VideoLibrary {
  videos: ProjectVideo[];
  usage: { used: number; limit: number };
  limits: VideoLimits;
  profile: "free" | "premium";
}

export const VIDEO_STATE_LABELS: Record<VideoState, string> = {
  uploading: "A carregar",
  validating: "A validar",
  available: "Disponível",
  interrupted: "Interrompido",
  failed: "Falhado",
  cancelled: "Cancelado",
};

export const ACTIVE_VIDEO_STATES: VideoState[] = [
  "uploading",
  "validating",
  "interrupted",
];

export const VIDEO_UNSUPPORTED_FORMAT =
  "Formato não suportado. Formatos aceites: MP4 (H.264) e MOV";

export const VIDEO_FILE_ACCEPT = ".mp4,.mov,video/mp4,video/quicktime";

export function hasVideoExtension(fileName: string) {
  return /\.(mp4|mov)$/i.test(fileName);
}

export function formatBytes(bytes: number) {
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  const value = Math.max(0, bytes);
  if (value >= GB) return `${+(value / GB).toFixed(1)} GB`;
  return `${+(value / MB).toFixed(1)} MB`;
}

export function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

// Message to show the user for a failed video request. The backend sends
// { code, message } with the message already written for the user.
export function getVideoErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (!error.response)
      return "Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.";

    const message = error.response.data?.message;
    if (typeof message === "string") return message;
  }

  return "Ocorreu um erro. Tente novamente.";
}

export function getVideoErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) return error.response?.data?.code;
  return undefined;
}

// Identifies a file without reading all of it (it may have 2 GB): SHA-256 of
// its first and last megabyte. Used, with the name and size, to resume an import.
export async function fingerprintFile(file: File) {
  const SAMPLE = 1024 * 1024;
  const head = await file.slice(0, SAMPLE).arrayBuffer();
  const tail = await file.slice(Math.max(0, file.size - SAMPLE)).arrayBuffer();

  const sample = new Uint8Array(head.byteLength + tail.byteLength);
  sample.set(new Uint8Array(head), 0);
  sample.set(new Uint8Array(tail), head.byteLength);

  const digest = await crypto.subtle.digest("SHA-256", sample);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface VideoRequest {
  uid: string;
  pid: string;
  token: string;
}

interface VideoIdRequest extends VideoRequest {
  videoId: string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const fetchProjectVideos = async ({ uid, pid, token }: VideoRequest) => {
  const response = await api.get<VideoLibrary>(`/projects/${uid}/${pid}/videos`, {
    headers: authHeaders(token),
  });

  return response.data;
};

export const fetchProjectVideo = async ({
  uid,
  pid,
  token,
  videoId,
}: VideoIdRequest) => {
  const response = await api.get<ProjectVideo>(
    `/projects/${uid}/${pid}/videos/${videoId}`,
    { headers: authHeaders(token) },
  );

  return response.data;
};

export const fetchProjectVideoUrl = async ({
  uid,
  pid,
  token,
  videoId,
}: VideoIdRequest) => {
  const response = await api.get<{ url: string }>(
    `/projects/${uid}/${pid}/videos/${videoId}/url`,
    { headers: authHeaders(token) },
  );

  return response.data.url;
};

export const createVideoImport = async ({
  uid,
  pid,
  token,
  name,
  size,
  fingerprint,
}: VideoRequest & { name: string; size: number; fingerprint: string }) => {
  const response = await api.post<{ video: ProjectVideo; chunkSize: number }>(
    `/projects/${uid}/${pid}/videos`,
    { name, size, fingerprint },
    { headers: authHeaders(token) },
  );

  return response.data;
};

export const uploadVideoChunk = async ({
  uid,
  pid,
  token,
  videoId,
  offset,
  chunk,
  signal,
  onProgress,
}: VideoIdRequest & {
  offset: number;
  chunk: Blob;
  signal?: AbortSignal;
  onProgress?: (loaded: number) => void;
}) => {
  const response = await api.put<{ received: number }>(
    `/projects/${uid}/${pid}/videos/${videoId}/chunk`,
    chunk,
    {
      params: { offset },
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/octet-stream",
      },
      signal,
      onUploadProgress: (event) => onProgress?.(event.loaded),
    },
  );

  return response.data.received;
};

const postVideoAction = async (
  { uid, pid, token, videoId }: VideoIdRequest,
  action: "complete" | "resume" | "interrupt" | "cancel",
  body: object = {},
) => {
  const response = await api.post<{ video: ProjectVideo; chunkSize?: number }>(
    `/projects/${uid}/${pid}/videos/${videoId}/${action}`,
    body,
    { headers: authHeaders(token) },
  );

  return response.data;
};

export const completeVideoImport = (request: VideoIdRequest) =>
  postVideoAction(request, "complete");

export const interruptVideoImport = (request: VideoIdRequest) =>
  postVideoAction(request, "interrupt");

export const cancelVideoImport = (request: VideoIdRequest) =>
  postVideoAction(request, "cancel");

export const resumeVideoImport = (
  request: VideoIdRequest & { name: string; size: number; fingerprint: string },
) =>
  postVideoAction(request, "resume", {
    name: request.name,
    size: request.size,
    fingerprint: request.fingerprint,
  });

export const deleteProjectVideo = async ({
  uid,
  pid,
  token,
  videoId,
}: VideoIdRequest) => {
  await api.delete(`/projects/${uid}/${pid}/videos/${videoId}`, {
    headers: authHeaders(token),
  });
};
