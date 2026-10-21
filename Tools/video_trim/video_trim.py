"""
video_trim worker (UC-VID-001 - Recortar um vídeo).

Consumes trim requests from `video_trim_queue`, cuts the requested interval
with ffmpeg, uploads the result to storage through img_storage and reports
progress / result / failure / cancellation on `video_job_queue`, which is
consumed by the projects service.

Request message (published by projects on video_trim_queue):
{
  "messageId": "<jobId>",
  "timestamp": "<ISO 8601>",
  "procedure": "video_trim",
  "parameters": {
    "inputVideoURL": "<internal presigned URL of the original video>",
    "start": <seconds>, "end": <seconds>,
    "userId": "...", "projectId": "...",
    "outputFileName": "<file name for the result>",
    "format": "mp4" | "mov", "codec": "h264" | ...
  }
}

Reply messages (published on video_job_queue):
{ "jobId", "timestamp", "type": "progress", "progress": 0-100 }
{ "jobId", "timestamp", "type": "success", "output": {videoKey, fileName, size, duration, width, height, format, codec} }
{ "jobId", "timestamp", "type": "error", "error": {"code", "message"} }
{ "jobId", "timestamp", "type": "cancelled" }
"""

import datetime
import json
import os
import subprocess
import tempfile
import threading
import time

import pika
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USERNAME = os.getenv("RABBITMQ_USERNAME", "user")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "password")
IMG_STORAGE_URL = os.getenv("IMG_STORAGE_URL", "http://img_storage:11000")
PROJECTS_URL = os.getenv("PROJECTS_URL", "https://projects:9001")
# projects uses a self-signed certificate inside the Docker network (known debt in README)
PROJECTS_VERIFY_TLS = False

REQUEST_QUEUE = "video_trim_queue"
REPLY_QUEUE = "video_job_queue"
EXCHANGE = "picturas"

# RN6: progress must reach the user at least every 5 s; we report every 2 s.
PROGRESS_INTERVAL = 2.0
# How often we ask projects whether the job was cancelled (FA2).
CANCEL_CHECK_INTERVAL = 2.0
# Upper bound for one trim; above this the job is treated as failed (E5).
MAX_PROCESSING_SECONDS = int(os.getenv("VIDEO_TRIM_TIMEOUT", 15 * 60))

ERRORS = {
    "wrong_procedure": (2100, "O pedido recebido não é um recorte de vídeo."),
    "invalid_parameters": (2101, "Os parâmetros do recorte são inválidos."),
    "processing": (2102, "Não foi possível recortar o vídeo. Tente novamente."),
    "timeout": (2103, "O recorte excedeu o tempo máximo de processamento."),
    "upload": (2104, "Não foi possível guardar o vídeo recortado."),
}


class JobCancelled(Exception):
    pass


class JobFailed(Exception):
    def __init__(self, key):
        super().__init__(key)
        self.code, self.message = ERRORS[key]


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class VideoTrimWorker:
    def __init__(self):
        credentials = pika.PlainCredentials(RABBITMQ_USERNAME, RABBITMQ_PASSWORD)
        # heartbeat keeps the connection alive; we service it while ffmpeg runs
        params = pika.ConnectionParameters(
            RABBITMQ_HOST, RABBITMQ_PORT, "/", credentials, heartbeat=60
        )
        self._connection = pika.BlockingConnection(params)
        self._channel = self._connection.channel()
        self._channel.exchange_declare(
            exchange=EXCHANGE, exchange_type="direct", durable=True
        )
        for queue in (REQUEST_QUEUE, REPLY_QUEUE):
            self._channel.queue_declare(queue=queue, durable=True)
            self._channel.queue_bind(queue=queue, exchange=EXCHANGE, routing_key=queue)
        # one video at a time per worker; scale by running more containers
        self._channel.basic_qos(prefetch_count=1)

    # ------------------------------------------------------------------ messaging

    def _reply(self, job_id, msg_type, **fields):
        msg = {"jobId": job_id, "timestamp": now_iso(), "type": msg_type, **fields}
        self._channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=REPLY_QUEUE,
            body=json.dumps(msg),
            properties=pika.BasicProperties(delivery_mode=2),
        )

    def _was_cancelled(self, job_id):
        """Asks projects for the job state. Any error counts as 'not cancelled'."""
        try:
            resp = requests.get(
                f"{PROJECTS_URL}/internal/video-jobs/{job_id}/state",
                timeout=2, verify=PROJECTS_VERIFY_TLS,
            )
            return resp.ok and resp.json().get("state") == "cancelled"
        except requests.RequestException:
            return False

    # ------------------------------------------------------------------ ffmpeg

    @staticmethod
    def _has_audio(url):
        """Whether the input has an audio stream (needed to join the parts)."""
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "a",
                 "-show_entries", "stream=index", "-of", "csv=p=0", url],
                capture_output=True, text=True, timeout=60,
            )
            return out.returncode == 0 and out.stdout.strip() != ""
        except subprocess.SubprocessError:
            return False

    @classmethod
    def _ffmpeg_command(cls, params, out_path):
        start = float(params["start"])
        end = float(params["end"])
        mode = params.get("mode", "keep")
        tail = ["-movflags", "+faststart"] if params.get("format") == "mp4" else []

        if mode == "remove":
            # v1.5 (UC-VID-001/FA5): cut [start, end] out and join what is
            # before and after it. Only H.264 (checked by projects): joining
            # needs re-encoding, so the result keeps the codec.
            duration = float(params.get("duration") or end)
            parts = [(a, b) for a, b in ((0.0, start), (end, duration)) if b - a > 0.01]
            if len(parts) == 1:
                # the interval touches an end of the video: a plain trim
                start, end = parts[0]
            else:
                audio = cls._has_audio(params["inputVideoURL"])
                chains, inputs = [], ""
                for i, (a, b) in enumerate(parts):
                    chains.append(f"[0:v:0]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]")
                    inputs += f"[v{i}]"
                    if audio:
                        chains.append(f"[0:a:0]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS[a{i}]")
                        inputs += f"[a{i}]"
                chains.append(f"{inputs}concat=n={len(parts)}:v=1:a={1 if audio else 0}"
                              + ("[v][a]" if audio else "[v]"))
                cmd = [
                    "ffmpeg", "-y", "-hide_banner", "-nostats", "-loglevel", "error",
                    "-i", params["inputVideoURL"],
                    "-filter_complex", ";".join(chains), "-map", "[v]",
                ]
                if audio:
                    cmd += ["-map", "[a]", "-c:a", "aac", "-b:a", "192k"]
                cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]
                cmd += tail + ["-progress", "pipe:1", out_path]
                return cmd, sum(b - a for a, b in parts)

        length = end - start
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-nostats", "-loglevel", "error",
            "-ss", f"{start:.3f}",            # seek before input: fast and, with
            "-i", params["inputVideoURL"],    # re-encoding, frame accurate
            "-t", f"{length:.3f}",
            "-map", "0:v:0", "-map", "0:a?",  # first video stream + audio if any
        ]
        if params.get("codec") == "h264":
            # RN1/REQ-015: keep H.264 and cut exactly at the requested instants
            cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                    "-c:a", "aac", "-b:a", "192k"]
        else:
            # other MOV codecs: copy streams (no re-encoder for every codec);
            # the cut snaps to the nearest keyframe (see registo, decisão D5)
            cmd += ["-c", "copy"]
        cmd += tail + ["-progress", "pipe:1", out_path]
        return cmd, length

    def _run_ffmpeg(self, job_id, params, out_path):
        cmd, length = self._ffmpeg_command(params, out_path)
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1
        )

        # ffmpeg's output is read by background threads, so the main loop never
        # blocks on it and can keep serving RabbitMQ heartbeats, sending
        # progress and checking for cancellation.
        state = {"percent": 0}
        errors = []

        def read_progress():
            for line in proc.stdout:
                key, _, value = line.strip().partition("=")
                if key in ("out_time_us", "out_time_ms"):
                    try:
                        done = int(value) / 1_000_000
                        state["percent"] = max(
                            state["percent"], min(99, int(done / length * 100))
                        )
                    except ValueError:
                        pass

        def read_errors():
            for line in proc.stderr:
                errors.append(line)
                del errors[:-50]  # keep only the last lines

        readers = [
            threading.Thread(target=read_progress, daemon=True),
            threading.Thread(target=read_errors, daemon=True),
        ]
        for t in readers:
            t.start()

        started = time.monotonic()
        last_progress = last_cancel_check = 0.0
        self._reply(job_id, "progress", progress=0)

        while proc.poll() is None:
            # keep RabbitMQ heartbeats flowing while ffmpeg works
            self._connection.process_data_events(time_limit=0.5)

            elapsed = time.monotonic() - started
            if elapsed - last_progress >= PROGRESS_INTERVAL:
                self._reply(job_id, "progress", progress=state["percent"])
                last_progress = elapsed
            if elapsed - last_cancel_check >= CANCEL_CHECK_INTERVAL:
                last_cancel_check = elapsed
                if self._was_cancelled(job_id):
                    proc.kill()
                    proc.wait()
                    raise JobCancelled()
            if elapsed > MAX_PROCESSING_SECONDS:
                proc.kill()
                proc.wait()
                raise JobFailed("timeout")

        for t in readers:
            t.join(timeout=5)
        if proc.returncode != 0:
            print(f"[{job_id}] ffmpeg failed: {''.join(errors)[-2000:]}")
            raise JobFailed("processing")

    @staticmethod
    def _probe(path):
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=60, check=True,
        )
        info = json.loads(out.stdout)
        video = next(s for s in info["streams"] if s.get("codec_type") == "video")
        return {
            "duration": float(info["format"]["duration"]),
            "width": video.get("width"),
            "height": video.get("height"),
            "codec": video.get("codec_name"),
        }

    # ------------------------------------------------------------------ storage

    @staticmethod
    def _upload(params, path):
        file_name = params["outputFileName"]
        content_type = "video/quicktime" if params.get("format") == "mov" else "video/mp4"
        url = f"{IMG_STORAGE_URL}/video/{params['userId']}/{params['projectId']}/{file_name}"
        try:
            with open(path, "rb") as f:
                resp = requests.put(
                    url, data=f, timeout=600,
                    headers={"Content-Type": content_type,
                             "Content-Length": str(os.path.getsize(path))},
                )
            resp.raise_for_status()
            return resp.json()["data"]["videoKey"]
        except (requests.RequestException, KeyError, ValueError):
            raise JobFailed("upload")

    # ------------------------------------------------------------------ job

    @staticmethod
    def _validate(params):
        try:
            start, end = float(params["start"]), float(params["end"])
            ok = start >= 0 and end - start >= 1 and params["inputVideoURL"] \
                and params["userId"] and params["projectId"] and params["outputFileName"] \
                and params.get("mode", "keep") in ("keep", "remove")
        except (KeyError, TypeError, ValueError):
            ok = False
        if not ok:
            raise JobFailed("invalid_parameters")

    def _process(self, job_id, params):
        self._validate(params)
        # cancelled while still in the queue: do not even start
        if self._was_cancelled(job_id):
            raise JobCancelled()
        suffix = ".mov" if params.get("format") == "mov" else ".mp4"
        # the result only exists in a temp dir until it is complete, so a failed
        # or cancelled job never leaves partial files in storage (REQ-014/020)
        with tempfile.TemporaryDirectory(prefix=f"trim-{job_id}-") as tmp:
            out_path = os.path.join(tmp, "out" + suffix)
            self._run_ffmpeg(job_id, params, out_path)
            if self._was_cancelled(job_id):
                raise JobCancelled()
            meta = self._probe(out_path)
            size = os.path.getsize(out_path)
            video_key = self._upload(params, out_path)
        return {
            "videoKey": video_key,
            "fileName": params["outputFileName"],
            "size": size,
            "format": params.get("format"),
            **meta,
        }

    def on_message(self, ch, method, properties, body):
        try:
            info = json.loads(body)
        except ValueError:
            print("Discarding malformed message")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        job_id = info.get("messageId")
        print(f"[{job_id}] received trim request")
        try:
            if info.get("procedure") != "video_trim":
                raise JobFailed("wrong_procedure")
            output = self._process(job_id, info.get("parameters") or {})
            self._reply(job_id, "progress", progress=100)
            self._reply(job_id, "success", output=output)
            print(f"[{job_id}] done: {output['videoKey']}")
        except JobCancelled:
            self._reply(job_id, "cancelled")
            print(f"[{job_id}] cancelled")
        except JobFailed as e:
            self._reply(job_id, "error", error={"code": e.code, "message": e.message})
            print(f"[{job_id}] failed: {e.code}")
        except Exception as e:  # never let one bad job kill the worker
            code, message = ERRORS["processing"]
            self._reply(job_id, "error", error={"code": code, "message": message})
            print(f"[{job_id}] unexpected error: {e!r}")
        finally:
            # ack only after the job is finished, so a crash re-delivers it
            ch.basic_ack(delivery_tag=method.delivery_tag)

    def run(self):
        self._channel.basic_consume(queue=REQUEST_QUEUE, on_message_callback=self.on_message)
        print("video_trim worker waiting for requests")
        self._channel.start_consuming()


if __name__ == "__main__":
    # RabbitMQ may still be starting; retry instead of crash-looping
    while True:
        try:
            VideoTrimWorker().run()
        except pika.exceptions.AMQPConnectionError:
            print("RabbitMQ unavailable, retrying in 5 s")
            time.sleep(5)
