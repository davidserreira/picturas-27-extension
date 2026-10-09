FROM python:3.11-slim

WORKDIR /app
COPY ./video_apply/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ./utils ./utils
COPY ./video_apply .

CMD ["python", "-u", "video_apply.py"]
