"""Real worker child/HTTP tests; only the broker channel is replaced."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Tools"))
from video_apply import video_apply as module


class Connection:
    def __init__(self): self.events = 0
    def process_data_events(self, time_limit):
        self.events += 1
        time.sleep(min(time_limit, 0.05))


class WorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.source = Path(cls.temp.name) / "input.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                        "testsrc2=size=64x48:rate=12:duration=1", "-c:v", "libx264",
                        "-threads", "1", str(cls.source)], check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def setUp(self):
        self.state = "queued"
        self.upload = None
        self.deletes = 0
        self.downloads = 0
        self.slow_download = False
        self.cancel_after_upload = False
        self.corrupt = False
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/source":
                    owner.downloads += 1
                    if owner.slow_download:
                        time.sleep(4)
                    payload = b"bad media" if owner.corrupt else owner.source.read_bytes()
                else:
                    # Cancel after the first state query, while the child downloads.
                    state = owner.state
                    if owner.slow_download: owner.state = "cancelled"
                    payload = json.dumps({"state": state}).encode()
                self.send_response(200); self.end_headers()
                try: self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError): pass

            def do_PUT(self):
                owner.upload = self.rfile.read(int(self.headers["Content-Length"]))
                if owner.cancel_after_upload: owner.state = "cancelled"
                self.send_response(201); self.end_headers()
                self.wfile.write(json.dumps({"data": {"videoKey": "project/video/result.mp4"}}).encode())

            def do_DELETE(self):
                owner.upload = None
                owner.deletes += 1
                self.send_response(201); self.end_headers(); self.wfile.write(b"{}")

            def log_message(self, *_): pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.env = patch.dict(os.environ, {"PROJECTS_URL": self.url, "IMG_STORAGE_URL": self.url})
        self.env.start()
        self.urls = patch.multiple(module, PROJECTS_URL=self.url, STORAGE_URL=self.url)
        self.urls.start()
        self.worker = object.__new__(module.VideoApplyWorker)
        self.worker.connection = Connection()
        self.replies = []
        self.worker.reply = lambda job, kind, **fields: self.replies.append({"type": kind, **fields})
        self.job = "100000000000000000000001"
        self.params = {
            "inputVideoURL": self.url + "/source", "userId": "200000000000000000000001",
            "projectId": "300000000000000000000001", "outputFileName": self.job + ".mp4",
            "format": "mp4", "codec": "h264", "maxDuration": 120, "maxOutputBytes": 1024**3,
            "tools": [{"type": "rotate", "degrees": 90}], "width": 48, "height": 64,
        }
        self.directories = []
        real_temporary_directory = tempfile.TemporaryDirectory
        def observe(*args, **kwargs):
            directory = real_temporary_directory(*args, **kwargs)
            self.directories.append(directory.name)
            return directory
        self.temporary = patch.object(module.tempfile, "TemporaryDirectory", side_effect=observe)
        self.temporary.start()

    def tearDown(self):
        self.temporary.stop(); self.urls.stop(); self.env.stop()
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.assertTrue(all(not Path(path).exists() for path in self.directories))

    def test_child_downloads_processes_and_uploads_complete_video(self):
        result = self.worker.process(self.job, self.params)
        self.assertEqual(result["type"], "success")
        self.assertEqual(result["output"]["frame_count"], 12)
        self.assertEqual(result["output"]["width"], 48)
        self.assertGreater(len(self.upload), 0)
        self.assertEqual(self.deletes, 0)
        self.assertGreater(self.worker.connection.events, 0)
        self.assertEqual(self.replies[-1]["framesProcessed"], 12)

    def test_cancelled_queue_does_not_download_or_process(self):
        self.state = "cancelled"
        self.assertEqual(self.worker.process(self.job, self.params)["type"], "cancelled")
        self.assertEqual(self.downloads, 0)
        self.assertIsNone(self.upload)

    def test_cancel_during_download_kills_child_and_removes_temporaries(self):
        self.slow_download = True
        started = time.monotonic()
        result = self.worker.process(self.job, self.params)
        self.assertEqual(result["type"], "cancelled")
        self.assertLess(time.monotonic() - started, 4)
        self.assertEqual(self.deletes, 1)
        self.assertTrue(any(reply["type"] == "progress" for reply in self.replies))

    def test_cancel_after_upload_removes_the_stored_result(self):
        self.cancel_after_upload = True
        result = self.worker.process(self.job, self.params)
        self.assertEqual(result["type"], "cancelled")
        self.assertIsNone(self.upload)
        self.assertEqual(self.deletes, 1)

    def test_corrupt_video_returns_required_error_without_a_result(self):
        self.corrupt = True
        result = self.worker.process(self.job, self.params)
        self.assertEqual(result["type"], "error")
        self.assertEqual(result["error"]["message"], module.FAILED_MESSAGE)
        self.assertIsNone(self.upload)
        self.assertEqual(self.deletes, 1)

    def test_replayed_completed_request_preserves_existing_result(self):
        self.state = "completed"; self.upload = b"already published"
        self.assertIsNone(self.worker.process(self.job, self.params))
        self.assertEqual(self.upload, b"already published")
        self.assertEqual(self.downloads, 0)
        self.assertEqual(self.deletes, 0)


if __name__ == "__main__": unittest.main(verbosity=2)
