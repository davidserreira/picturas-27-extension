"""Apply shared Pillow tools to every frame; remux audio without re-encoding."""

import os
from fractions import Fraction

import av

from utils.image_operations import apply_chain, chain_dimensions, validate_chain


class JobCancelled(Exception):
    pass


class ProcessingError(Exception):
    pass


ENCODERS = {"h264": "libx264", "hevc": "libx265", "prores": "prores_ks"}


def pixel_format(encoder, source_format, width, height):
    supported = [fmt.name for fmt in av.Codec(encoder, "w").video_formats or []]
    # Chroma subsampling requires even dimensions. Use 4:4:4 for an odd
    # H.264 output instead of silently cropping or padding the requested size.
    preferences = ["yuv420p", source_format, "yuv444p", "rgb24", "yuv422p10le"]
    for name in preferences + supported:
        if name not in supported:
            continue
        if ("420" in name and (width % 2 or height % 2)) or ("422" in name and width % 2):
            continue
        return name
    raise ProcessingError("No encoder pixel format for the requested dimensions")


def process_video(input_path, output_path, tools, container_format, codec,
                  should_cancel=lambda: False, on_progress=lambda *_: None,
                  max_duration=600, max_output_bytes=10 * 1024**3):
    validate_chain(tools)
    if container_format not in ("mp4", "mov") or (container_format == "mp4" and codec != "h264"):
        raise ProcessingError("Unsupported container/codec")
    frames_processed = 0
    try:
        with av.open(input_path) as source:
            if not source.streams.video:
                raise ProcessingError("No video stream")
            stream = source.streams.video[0]
            if stream.codec_context.name != codec:
                raise ProcessingError("Source codec does not match its metadata")
            duration = float(source.duration / av.time_base) if source.duration else 0
            if duration <= 0 or duration > max_duration + 0.001:
                raise ProcessingError("Duration exceeds this job's limit")
            width, height = chain_dimensions(stream.width, stream.height, tools)
            rate = stream.average_rate or stream.guessed_rate
            if not rate or not stream.time_base:
                raise ProcessingError("Unknown frame rate or timestamps")
            frame_count = stream.frames or None  # exact when the container supplies it
            encoder = ENCODERS.get(codec, codec)
            options = {"movflags": "+faststart"}
            with av.open(output_path, "w", format=container_format, options=options) as output:
                output.metadata.update(source.metadata)
                video = output.add_stream(encoder, rate=rate)
                video.width, video.height = width, height
                video.pix_fmt = pixel_format(encoder, stream.codec_context.format.name, width, height)
                video.time_base = video.codec_context.time_base = stream.time_base
                video.codec_context.sample_aspect_ratio = Fraction(1, 1)
                if codec == "h264":
                    video.options = {"preset": "veryfast", "crf": "18"}
                elif codec == "hevc":
                    video.options = {"preset": "fast", "crf": "18"}
                elif codec == "mpeg4":
                    video.bit_rate = max(stream.bit_rate or 0, width * height * int(rate) // 4)
                audio = {s.index: output.add_stream_from_template(s) for s in source.streams.audio}
                durations = {}
                first_pts = last_pts = None

                def mux_encoded(packet):
                    if packet.pts in durations:
                        packet.duration = durations.pop(packet.pts)
                    output.mux(packet)

                for packet in source.demux(stream, *source.streams.audio):
                    if should_cancel():
                        raise JobCancelled()
                    if packet.stream.index in audio:
                        if packet.dts is not None:
                            packet.stream = audio[packet.stream.index]
                            output.mux(packet)
                        continue
                    for frame in packet.decode():
                        if should_cancel():
                            raise JobCancelled()
                        if frame.is_corrupt or frame.pts is None or frame.time_base != stream.time_base:
                            raise ProcessingError("Corrupt frame or missing timestamps")
                        if first_pts is None:
                            first_pts = frame.pts
                        if last_pts is not None and frame.pts <= last_pts:
                            raise ProcessingError("Non-monotonic frame timestamps")
                        last_pts = frame.pts
                        if (last_pts - first_pts) * stream.time_base > max_duration:
                            raise ProcessingError("Decoded duration exceeds this job's limit")
                        if (frame.width, frame.height) != (stream.width, stream.height):
                            raise ProcessingError("Variable resolution is outside the MVP")
                        with frame.to_image() as original:
                            image = apply_chain(original, tools)
                            try:
                                edited = av.VideoFrame.from_image(image.convert("RGB"))
                            finally:
                                if image is not original:
                                    image.close()
                        edited.pts, edited.time_base, edited.duration = frame.pts, frame.time_base, frame.duration
                        durations[frame.pts] = frame.duration
                        for encoded in video.encode(edited):
                            mux_encoded(encoded)
                        frames_processed += 1
                        percent = min(95, int(frames_processed / frame_count * 95)) if frame_count else min(95, int(float(frame.time) / duration * 95))
                        on_progress(percent, frames_processed, frame_count)
                        if os.path.exists(output_path) and os.path.getsize(output_path) > max_output_bytes:
                            raise ProcessingError("Output exceeds the storage limit")
                for encoded in video.encode():
                    mux_encoded(encoded)
            if frames_processed == 0 or (frame_count and frames_processed != frame_count):
                raise ProcessingError("A frame was lost while decoding")
            if should_cancel():
                raise JobCancelled()
            if os.path.getsize(output_path) > max_output_bytes:
                raise ProcessingError("Output exceeds the storage limit")
        # Reopen the complete container before making it visible in storage.
        with av.open(output_path) as result:
            result_stream = result.streams.video[0]
            if result_stream.codec_context.name != codec or result_stream.average_rate != rate or (result_stream.frames and result_stream.frames != frames_processed):
                raise ProcessingError("Result codec/frame count differs")
            return {
                "format": container_format, "codec": codec, "width": width, "height": height,
                "duration": float(result.duration / av.time_base),
                "frame_count": frames_processed, "fps": float(rate),
                "size": os.path.getsize(output_path),
            }
    except Exception:
        # A partial local file is never a usable result, including cancellation.
        if os.path.exists(output_path):
            os.remove(output_path)
        raise
