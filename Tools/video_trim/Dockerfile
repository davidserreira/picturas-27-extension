FROM python:3.11-slim

# ffmpeg/ffprobe do the actual trimming and the inspection of the result
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./video_trim/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./video_trim .

CMD ["python", "-u", "video_trim.py"]
