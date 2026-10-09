"""UC-VID-003 worker. A child process keeps processing off the broker thread."""

import datetime
import json
import multiprocessing
import os
import queue
import re
import tempfile
import time

import pika
import requests
import urllib3

if __package__:
    from .processing import process_video
else:
    from processing import process_video
from utils.image_operations import validate_chain

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
EXCHANGE = "picturas"
REQUEST_QUEUE = "video_apply_queue"
REPLY_QUEUE = "video_job_queue"
PROJECTS_URL = os.getenv("PROJECTS_URL", "https://projects:9001")
STORAGE_URL = os.getenv("IMG_STORAGE_URL", "http://img_storage:11000")
TIMEOUT = int(os.getenv("VIDEO_APPLY_TIMEOUT", "900"))
FAILED_MESSAGE = "Não foi possível aplicar as ferramentas ao vídeo. Tente novamente."


def storage_url(params):
    return f"{STORAGE_URL}/video/{params['userId']}/{params['projectId']}/{params['outputFileName']}"


def execute_job(params, directory, progress, frames, total, results):
    """Spawn entry point. Only a complete file is uploaded; one frame in memory."""
    try:
        input_path = os.path.join(directory, "input." + params["format"])
        output_path = os.path.join(directory, "output." + params["format"])
        with requests.get(params["inputVideoURL"], stream=True, timeout=(5, 30)) as response:
            response.raise_for_status()
            with open(input_path, "wb") as target:
                for chunk in response.iter_content(1024 * 1024):
                    target.write(chunk)

        def report(percent, done, count):
            progress.value = percent
            frames.value = done
            total.value = count or 0

        metadata = process_video(
            input_path, output_path, params["tools"], params["format"], params["codec"],
            on_progress=report, max_duration=params["maxDuration"],
            max_output_bytes=params["maxOutputBytes"],
        )
        if (metadata["width"], metadata["height"]) != (params["width"], params["height"]):
            raise ValueError("Result dimensions do not match the validated chain")
        total.value = frames.value = metadata["frame_count"]
        progress.value = 98
        with open(output_path, "rb") as video:
            response = requests.put(storage_url(params), data=video, timeout=(5, 60), headers={
                "Content-Type": "video/quicktime" if params["format"] == "mov" else "video/mp4",
                "Content-Length": str(metadata["size"]),
            })
        response.raise_for_status()
        video_key = response.json()["data"]["videoKey"]
        results.put({"type": "success", "output": {
            **metadata, "videoKey": video_key, "fileName": params["outputFileName"],
        }})
    except Exception as error:
        # Log the cause internally; do not expose paths or storage URLs to users.
        print(f"[video-apply] processing failed: {type(error).__name__}: {error}", flush=True)
        results.put({"type": "error", "error": {"code": "PROCESSING_FAILED", "message": FAILED_MESSAGE}})


class VideoApplyWorker:
    def __init__(self):
        credentials = pika.PlainCredentials(os.getenv("RABBITMQ_USERNAME", "user"),
                                            os.getenv("RABBITMQ_PASSWORD", "password"))
        self.connection = pika.BlockingConnection(pika.ConnectionParameters(
            os.getenv("RABBITMQ_HOST", "rabbitmq"), int(os.getenv("RABBITMQ_PORT", "5672")),
            "/", credentials, heartbeat=60, blocked_connection_timeout=30,
        ))
        self.channel = self.connection.channel()
        self.channel.exchange_declare(exchange=EXCHANGE, exchange_type="direct", durable=True)
        for name in (REQUEST_QUEUE, REPLY_QUEUE):
            self.channel.queue_declare(queue=name, durable=True)
            self.channel.queue_bind(queue=name, exchange=EXCHANGE, routing_key=name)
        self.channel.basic_qos(prefetch_count=1)
        self.channel.confirm_delivery()

    def reply(self, job_id, kind, **fields):
        self.channel.basic_publish(exchange=EXCHANGE, routing_key=REPLY_QUEUE,
            body=json.dumps({"jobId": job_id, "type": kind,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields}),
            properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
            mandatory=True)

    @staticmethod
    def job_state(job_id):
        response = requests.get(f"{PROJECTS_URL}/internal/video-jobs/{job_id}/state",
                                timeout=2, verify=False)
        if response.status_code == 404:
            return "missing"
        response.raise_for_status()
        return response.json()["state"]

    @staticmethod
    def cleanup_storage(params):
        response = requests.delete(
            f"{STORAGE_URL}/delete/{params['userId']}/{params['projectId']}/video/{params['outputFileName']}",
            timeout=5,
        )
        if response.status_code != 404:
            response.raise_for_status()

    def process(self, job_id, params):
        validate_chain(params.get("tools"))
        if params.get("format") not in ("mp4", "mov") or not params.get("codec"):
            raise ValueError("Unsupported video")
        if params.get("outputFileName") != f"{job_id}.{params['format']}":
            raise ValueError("Invalid output name")
        for key in ("inputVideoURL", "userId", "projectId", "maxDuration", "maxOutputBytes", "width", "height"):
            if not params.get(key):
                raise ValueError("Missing job parameter")
        state = self.job_state(job_id)
        if state not in ("queued", "processing"):
            if state != "completed":
                # Also clean on replay after a storage/network interruption.
                self.cleanup_storage(params)
            return {"type": "cancelled"} if state == "cancelled" else None
        context = multiprocessing.get_context("spawn")
        progress, frames, total = context.Value("i", 0), context.Value("q", 0), context.Value("q", 0)
        results = context.Queue()
        with tempfile.TemporaryDirectory(prefix="video-apply-") as directory:
            child = context.Process(target=execute_job, args=(params, directory, progress, frames, total, results))
            child.start()
            started = last_report = last_check = time.monotonic()
            terminal = None
            try:
                self.reply(job_id, "progress", progress=0, framesProcessed=0, frameCount=None)
                while child.is_alive():
                    # No decode, filter or upload can block heartbeats/progress.
                    self.connection.process_data_events(time_limit=0.25)
                    now = time.monotonic()
                    if now - last_report >= 2:
                        self.reply(job_id, "progress", progress=progress.value,
                                   framesProcessed=frames.value, frameCount=total.value or None)
                        last_report = now
                    if now - last_check >= 2:
                        state = self.job_state(job_id)
                        last_check = now
                        if state not in ("queued", "processing"):
                            terminal = {"type": "ignored"} if state == "completed" else {"type": "cancelled"}
                            break
                    if now - started >= TIMEOUT:
                        terminal = {"type": "error", "error": {"code": "TIMEOUT", "message": FAILED_MESSAGE}}
                        break
                if terminal:
                    child.terminate()
                child.join(timeout=5)
                if child.is_alive():
                    child.kill()
                    child.join()
                if not terminal:
                    try:
                        terminal = results.get(timeout=2)
                    except queue.Empty:
                        terminal = {"type": "error", "error": {"code": "WORKER_FAILED", "message": FAILED_MESSAGE}}
                if terminal["type"] == "success":
                    state = self.job_state(job_id)
                    if state not in ("queued", "processing"):
                        terminal = {"type": "ignored"} if state == "completed" else {"type": "cancelled"}
                if terminal["type"] == "ignored":
                    return None
                if terminal["type"] != "success":
                    self.cleanup_storage(params)
                else:
                    self.reply(job_id, "progress", progress=99, framesProcessed=frames.value, frameCount=total.value)
                return terminal
            finally:
                if child.is_alive():
                    child.terminate()
                    child.join(timeout=5)
                    if child.is_alive():
                        child.kill()
                        child.join()
                results.close()

    def on_message(self, channel, method, properties, body):
        try:
            message = json.loads(body)
            if not isinstance(message, dict) or not isinstance(message.get("messageId"), str) or not re.fullmatch(r"[a-fA-F0-9]{24}", message["messageId"]):
                raise ValueError("Invalid message")
        except (ValueError, TypeError):
            channel.basic_ack(method.delivery_tag)
            return
        job_id = message["messageId"]
        try:
            if message.get("procedure") != "video_apply":
                terminal = {"type": "error", "error": {"code": "INVALID_PROCEDURE", "message": FAILED_MESSAGE}}
            else:
                terminal = self.process(job_id, message.get("parameters") or {})
            if terminal:
                kind = terminal.pop("type")
                self.reply(job_id, kind, **terminal)
        except (requests.RequestException, pika.exceptions.AMQPError):
            # Network interruption: leave the request unacked for safe replay.
            raise
        except Exception as error:
            print(f"[{job_id}] failed: {type(error).__name__}: {error}", flush=True)
            self.reply(job_id, "error", error={"code": "PROCESSING_FAILED", "message": FAILED_MESSAGE})
        channel.basic_ack(method.delivery_tag)

    def run(self):
        self.channel.basic_consume(queue=REQUEST_QUEUE, on_message_callback=self.on_message)
        print("video_apply worker waiting for requests", flush=True)
        self.channel.start_consuming()


if __name__ == "__main__":
    while True:
        try:
            worker = VideoApplyWorker()
            try:
                worker.run()
            finally:
                if worker.connection.is_open:
                    worker.connection.close()
        except (pika.exceptions.AMQPError, requests.RequestException) as error:
            print(f"[video-apply] service unavailable: {type(error).__name__}; retry in 5 s", flush=True)
            time.sleep(5)
