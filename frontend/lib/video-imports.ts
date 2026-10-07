import axios from "axios";
import { useSyncExternalStore } from "react";
import {
  cancelVideoImport,
  completeVideoImport,
  createVideoImport,
  fetchProjectVideo,
  fingerprintFile,
  getVideoErrorCode,
  interruptVideoImport,
  resumeVideoImport,
  uploadVideoChunk,
  VideoState,
} from "./videos";

// Video uploads run here, outside of any component, so that they keep going
// while the user navigates to other pages of the app.

export interface VideoImportTask {
  id: string;
  uid: string;
  pid: string;
  name: string;
  size: number;
  sent: number; // bytes sent so far, including the chunk in flight
  state: VideoState;
  reason: string | null;
}

interface Entry {
  task: VideoImportTask;
  token: string;
  chunkSize: number;
  file?: File;
  controller?: AbortController;
  running: boolean;
}

const RETRY_DELAYS = [1000, 3000];
const WATCH_INTERVAL = 2000;
const EMIT_INTERVAL = 200;

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const EMPTY: VideoImportTask[] = [];
let snapshot: VideoImportTask[] = EMPTY;
let emitTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
  snapshot = Array.from(entries.values(), (entry) => ({ ...entry.task }));
  listeners.forEach((listener) => listener());
}

function update(entry: Entry, changes: Partial<VideoImportTask>) {
  Object.assign(entry.task, changes);
  emit();
}

// Progress within a chunk arrives very often; publish it at a calmer pace.
function progress(entry: Entry, sent: number) {
  entry.task.sent = sent;
  if (!emitTimer) emitTimer = setTimeout(emit, EMIT_INTERVAL);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestOf(entry: Entry) {
  const { uid, pid, id } = entry.task;
  return { uid, pid, token: entry.token, videoId: id };
}

// Errors worth retrying: no answer from the server, or a server-side failure.
function isTransient(error: unknown) {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return false;
  if (!error.response) return true;
  return (
    error.response.status >= 500 ||
    getVideoErrorCode(error) === "CHUNK_IN_PROGRESS"
  );
}

function isNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

async function sendChunk(entry: Entry, offset: number, chunk: Blob) {
  for (let attempt = 0; ; attempt++) {
    entry.controller = new AbortController();
    try {
      return await uploadVideoChunk({
        ...requestOf(entry),
        offset,
        chunk,
        signal: entry.controller.signal,
        onProgress: (loaded) =>
          progress(entry, offset + Math.min(loaded, chunk.size)),
      });
    } catch (error) {
      if (
        entry.task.state !== "uploading" ||
        !isTransient(error) ||
        attempt >= RETRY_DELAYS.length
      )
        throw error;
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
}

// The connection is gone: stop here and let the user resume later.
function interrupt(entry: Entry, sent: number) {
  update(entry, { state: "interrupted", sent });
  interruptVideoImport(requestOf(entry)).catch(() => {});
}

async function syncWithServer(entry: Entry) {
  try {
    const video = await fetchProjectVideo(requestOf(entry));
    update(entry, {
      state: video.state,
      reason: video.reason,
      sent: video.received,
    });
  } catch (error) {
    if (isNotFound(error)) {
      entries.delete(entry.task.id);
      emit();
    } else {
      update(entry, { state: "interrupted" });
    }
  }
}

// Follows the validation that runs on the server once the upload is complete.
async function watch(entry: Entry) {
  const { task } = entry;
  while (entries.get(task.id) === entry && task.state === "validating") {
    await sleep(WATCH_INTERVAL);
    try {
      const video = await fetchProjectVideo(requestOf(entry));
      if (video.state !== task.state)
        update(entry, { state: video.state, reason: video.reason });
    } catch (error) {
      if (isNotFound(error)) {
        entries.delete(task.id);
        emit();
        return;
      }
    }
  }
}

async function run(entry: Entry) {
  if (entry.running) return;
  entry.running = true;

  const { task } = entry;
  try {
    let offset = task.sent;

    while (offset < task.size) {
      if (task.state !== "uploading" || !entry.file) return;

      const chunk = entry.file.slice(offset, offset + entry.chunkSize);
      try {
        offset = await sendChunk(entry, offset, chunk);
        update(entry, { sent: offset });
      } catch (error) {
        if (task.state !== "uploading") return; // cancelled meanwhile

        // the server has a different position (e.g. a retried chunk had been stored)
        const received = axios.isAxiosError(error)
          ? error.response?.data?.received
          : undefined;
        if (
          getVideoErrorCode(error) === "OFFSET_MISMATCH" &&
          typeof received === "number"
        ) {
          offset = received;
          update(entry, { sent: offset });
          continue;
        }

        if (isTransient(error)) return interrupt(entry, offset);
        return await syncWithServer(entry);
      }
    }

    if (task.state !== "uploading") return;

    try {
      await completeVideoImport(requestOf(entry));
    } catch (error) {
      if (isTransient(error)) return interrupt(entry, offset);
      return await syncWithServer(entry);
    }

    entry.file = undefined;
    update(entry, { state: "validating", sent: task.size });
    await watch(entry);
  } finally {
    entry.running = false;
  }
}

/**
 * Creates the import request and starts sending the file in the background.
 * Rejects (with the server's error) if the request is refused.
 */
export async function startVideoImport({
  uid,
  pid,
  token,
  file,
}: {
  uid: string;
  pid: string;
  token: string;
  file: File;
}) {
  const fingerprint = await fingerprintFile(file);
  const { video, chunkSize } = await createVideoImport({
    uid,
    pid,
    token,
    name: file.name,
    size: file.size,
    fingerprint,
  });

  const entry: Entry = {
    task: {
      id: video._id,
      uid,
      pid,
      name: video.name,
      size: video.size,
      sent: 0,
      state: "uploading",
      reason: null,
    },
    token,
    chunkSize,
    file,
    running: false,
  };
  entries.set(video._id, entry);
  emit();
  void run(entry);

  return video;
}

// Whether an import can be resumed without asking the user for the file again.
export function hasVideoImportFile(videoId: string) {
  return !!entries.get(videoId)?.file;
}

/**
 * Resumes an interrupted import from where the server left off. `file` is
 * needed when this tab no longer holds it (e.g. the page was reloaded).
 */
export async function resumeVideoImportTask({
  uid,
  pid,
  token,
  videoId,
  file,
}: {
  uid: string;
  pid: string;
  token: string;
  videoId: string;
  file?: File;
}) {
  let entry = entries.get(videoId);
  const source = file ?? entry?.file;
  if (!source) throw new Error("FILE_REQUIRED");

  const fingerprint = await fingerprintFile(source);
  const { video, chunkSize } = await resumeVideoImport({
    uid,
    pid,
    token,
    videoId,
    name: source.name,
    size: source.size,
    fingerprint,
  });

  if (!entry) {
    entry = {
      task: {
        id: video._id,
        uid,
        pid,
        name: video.name,
        size: video.size,
        sent: video.received,
        state: "uploading",
        reason: null,
      },
      token,
      chunkSize: chunkSize ?? 0,
      running: false,
    };
    entries.set(videoId, entry);
  }

  entry.file = source;
  entry.token = token;
  if (chunkSize) entry.chunkSize = chunkSize;
  update(entry, { state: "uploading", sent: video.received, reason: null });
  void run(entry);
}

export async function cancelVideoImportTask({
  uid,
  pid,
  token,
  videoId,
}: {
  uid: string;
  pid: string;
  token: string;
  videoId: string;
}) {
  const entry = entries.get(videoId);
  if (entry) {
    update(entry, { state: "cancelled", reason: null });
    entry.controller?.abort();
    entry.file = undefined;
  }

  try {
    await cancelVideoImport({ uid, pid, token, videoId });
  } catch (error) {
    if (entry) await syncWithServer(entry);
    throw error;
  }
}

// Cancels an import started in this tab, with the session it was started with.
export async function cancelLocalVideoImport(videoId: string) {
  const entry = entries.get(videoId);
  if (!entry) return;
  await cancelVideoImportTask(requestOf(entry));
}

// Forgets an import that has finished (it stays in the project's video list).
export function dismissVideoImport(videoId: string) {
  if (entries.delete(videoId)) emit();
}

// The project whose video list is on screen right now, if any: its imports are
// shown there, so the floating indicator leaves them out.
let listedProject: string | null = null;

export function setListedVideoProject(pid: string | null) {
  if (listedProject === pid) return;
  listedProject = pid;
  listeners.forEach((listener) => listener());
}

export function useListedVideoProject() {
  return useSyncExternalStore(
    subscribe,
    () => listedProject,
    () => null,
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVideoImports() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
