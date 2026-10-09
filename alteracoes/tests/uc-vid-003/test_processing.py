"""Real media tests. No RabbitMQ/MongoDB required; requires ffmpeg and PyAV."""

import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from fractions import Fraction
from unittest.mock import patch

import av
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Tools"))
from utils.image_operations import apply_chain, chain_dimensions, validate_chain
from video_apply.processing import JobCancelled, ProcessingError, process_video


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-filter_threads", "1", *args],
                   capture_output=True, check=True, timeout=30)


def video_frames(path):
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        frames = list(container.decode(stream))
        return frames, stream.average_rate, stream.codec_context.name


def audio_packets(path):
    with av.open(str(path)) as container:
        streams = list(container.streams.audio)
        if not streams: return []
        packets = {stream.index: [] for stream in streams}
        for packet in container.demux(*streams):
            if packet.dts is not None:
                packets[packet.stream.index].append((hashlib.sha256(bytes(packet)).hexdigest(),
                    packet.pts * packet.time_base, packet.duration * packet.time_base))
        return list(packets.values())


class ProcessingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="uc-vid-003-test-")
        cls.root = Path(cls.tmp.name)
        cls.mp4 = cls.root / "source.mp4"
        ffmpeg("-f", "lavfi", "-i", "testsrc2=size=96x64:rate=12:duration=2",
               "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
               "-c:v", "libx264", "-threads", "1", "-c:a", "aac", str(cls.mp4))
        cls.mov = cls.root / "source.mov"
        ffmpeg("-f", "lavfi", "-i", "testsrc=size=63x47:rate=10:duration=1",
               "-c:v", "png", "-threads", "1", "-pix_fmt", "rgb24", str(cls.mov))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def run_chain(self, tools, source=None, format="mp4", codec="h264", **kwargs):
        target = self.root / (self._testMethodName + "." + format)
        metadata = process_video(str(source or self.mp4), str(target), tools, format, codec, **kwargs)
        return target, metadata

    def test_mp4_frames_timestamps_audio_and_original_preserved(self):
        before = hashlib.sha256(self.mp4.read_bytes()).digest()
        progress = []
        target, meta = self.run_chain([
            {"type": "resize", "width": 80, "height": 48},
            {"type": "binarization", "threshold": 128},
            {"type": "rotate", "degrees": 90},
        ], on_progress=lambda *values: progress.append(values))
        original, rate, codec = video_frames(self.mp4)
        result, new_rate, new_codec = video_frames(target)
        self.assertEqual((len(result), new_rate, new_codec), (len(original), rate, codec))
        self.assertEqual([f.pts * f.time_base for f in result], [f.pts * f.time_base for f in original])
        self.assertEqual(audio_packets(target), audio_packets(self.mp4))
        self.assertEqual((meta["width"], meta["height"], meta["frame_count"]), (48, 80, 24))
        self.assertEqual(progress[-1][1], 24)
        self.assertEqual(before, hashlib.sha256(self.mp4.read_bytes()).digest())

    def test_every_mov_frame_matches_shared_image_tools_exactly(self):
        tools = [{"type": "binarization", "threshold": 123},
                 {"type": "resize", "width": 48, "height": 32},
                 {"type": "rotate", "degrees": 270}]
        target, meta = self.run_chain(tools, self.mov, "mov", "png")
        original, rate, codec = video_frames(self.mov)
        result, new_rate, new_codec = video_frames(target)
        self.assertEqual((len(result), new_rate, new_codec), (len(original), rate, codec))
        for source, output in zip(original, result):
            expected = apply_chain(source.to_image(), tools).convert("RGB")
            self.assertEqual(output.to_image().tobytes(), expected.tobytes())
        self.assertEqual(meta["format"], "mov")

    def test_tools_follow_the_selected_order(self):
        first = [{"type": "resize", "width": 80, "height": 48}, {"type": "rotate", "degrees": 90}]
        second = list(reversed(first))
        self.assertEqual(chain_dimensions(96, 64, first), (48, 80))
        self.assertEqual(chain_dimensions(96, 64, second), (80, 48))
        image = Image.linear_gradient("L").resize((63, 47))
        a = [{"type": "resize", "width": 20, "height": 16}, {"type": "binarization", "threshold": 128}]
        self.assertNotEqual(apply_chain(image, a).tobytes(), apply_chain(image, list(reversed(a))).tobytes())

    def test_all_audio_tracks_preserved(self):
        source = self.root / "two-audio.mp4"
        ffmpeg("-i", str(self.mp4), "-f", "lavfi", "-i", "sine=frequency=880:duration=2",
               "-map", "0:v", "-map", "0:a", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", str(source))
        target, _ = self.run_chain([{"type": "rotate", "degrees": 180}], source)
        original = audio_packets(source)
        self.assertEqual(len(original), 2)
        self.assertTrue(all(original))
        self.assertEqual(audio_packets(target), original)

    def test_mov_prores_codec_and_pcm_audio_preserved(self):
        source = self.root / "prores.mov"
        ffmpeg("-i", str(self.mp4), "-c:v", "prores_ks", "-threads", "1", "-pix_fmt", "yuv422p10le",
               "-c:a", "pcm_s16le", str(source))
        target, meta = self.run_chain([{"type": "rotate", "degrees": 180}], source, "mov", "prores")
        original, rate, _ = video_frames(source)
        result, new_rate, codec = video_frames(target)
        self.assertEqual((len(result), new_rate, codec), (len(original), rate, "prores"))
        self.assertEqual(audio_packets(target), audio_packets(source))
        self.assertEqual(meta["codec"], "prores")

    def test_odd_h264_dimensions_are_not_cropped(self):
        target, meta = self.run_chain([{"type": "resize", "width": 65, "height": 33}])
        frames, _, _ = video_frames(target)
        self.assertTrue(all((frame.width, frame.height) == (65, 33) for frame in frames))
        self.assertEqual((meta["width"], meta["height"]), (65, 33))

    def test_fractional_frame_rate_preserved(self):
        source = self.root / "fractional.mp4"
        ffmpeg("-f", "lavfi", "-i", "testsrc2=size=64x48:rate=30000/1001:duration=1",
               "-c:v", "libx264", "-threads", "1", str(source))
        target, _ = self.run_chain([{"type": "rotate", "degrees": 180}], source)
        original, rate, _ = video_frames(source)
        result, new_rate, _ = video_frames(target)
        self.assertEqual(rate, Fraction(30000, 1001))
        self.assertEqual((len(result), new_rate), (len(original), rate))
        self.assertEqual([f.pts * f.time_base for f in result], [f.pts * f.time_base for f in original])

    def test_variable_frame_timestamps_preserved(self):
        source = self.root / "variable.mp4"
        with av.open(str(source), "w") as output:
            stream = output.add_stream("libx264", rate=25)
            stream.width, stream.height, stream.pix_fmt = 64, 48, "yuv420p"
            stream.time_base = stream.codec_context.time_base = Fraction(1, 1000)
            for pts in [0, 40, 120, 160, 300]:
                frame = av.VideoFrame.from_image(Image.new("RGB", (64, 48), (pts % 255, 128, 64)))
                frame.pts, frame.time_base = pts, Fraction(1, 1000)
                for packet in stream.encode(frame): output.mux(packet)
            for packet in stream.encode(): output.mux(packet)
        target, _ = self.run_chain([{"type": "rotate", "degrees": 180}], source)
        original, rate, _ = video_frames(source)
        result, new_rate, _ = video_frames(target)
        self.assertEqual([f.pts * f.time_base for f in result], [f.pts * f.time_base for f in original])
        self.assertEqual(new_rate, rate)

    def test_cancellation_removes_partial_result(self):
        done = [0]
        path = self.root / "cancelled.mp4"
        with self.assertRaises(JobCancelled):
            process_video(str(self.mp4), str(path), [{"type": "rotate", "degrees": 90}], "mp4", "h264",
                          should_cancel=lambda: done[0] >= 3,
                          on_progress=lambda _, frames, __: done.__setitem__(0, frames))
        self.assertEqual(done[0], 3)
        self.assertFalse(path.exists())

    def test_mid_frame_failure_removes_partial_result(self):
        count = [0]
        def fail_on_fourth(image, tools):
            count[0] += 1
            if count[0] == 4: raise ProcessingError("Injected frame failure")
            return apply_chain(image, tools)
        path = self.root / "failed.mp4"
        with patch("video_apply.processing.apply_chain", side_effect=fail_on_fourth), self.assertRaises(ProcessingError):
            process_video(str(self.mp4), str(path), [{"type": "rotate", "degrees": 90}], "mp4", "h264")
        self.assertEqual(count[0], 4)
        self.assertFalse(path.exists())

    def test_storage_limit_removes_result(self):
        path = self.root / "oversize.mp4"
        with self.assertRaises(ProcessingError):
            process_video(str(self.mp4), str(path), [{"type": "rotate", "degrees": 90}],
                          "mp4", "h264", max_output_bytes=100)
        self.assertFalse(path.exists())

    def test_duration_limit(self):
        with self.assertRaises(ProcessingError):
            self.run_chain([{"type": "rotate", "degrees": 90}], max_duration=1)

    def test_invalid_chain_parameters(self):
        for chain in [[], [{}], [{"type": "resize", "width": 15, "height": 16}],
                      [{"type": "resize", "width": 16.5, "height": 16}],
                      [{"type": "rotate", "degrees": 45}], [{"type": "binarization", "threshold": True}],
                      [{"type": "binarization", "threshold": 256}], [{"type": "ocr"}],
                      [{"type": "rotate", "degrees": 90}] * 4]:
            with self.subTest(chain=chain), self.assertRaises(ValueError): validate_chain(chain)
        for threshold in [0, 255]: validate_chain([{"type": "binarization", "threshold": threshold}])

    def test_bad_source_rejected(self):
        source = self.root / "bad.mp4"
        source.write_bytes(b"invalid media")
        with self.assertRaises(Exception):
            self.run_chain([{"type": "rotate", "degrees": 90}], source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
