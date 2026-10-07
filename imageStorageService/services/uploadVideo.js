const s3 = require("./s3Client");
const createBucket = require("./createBucket");

// Streams the body straight to S3 (multipart), so a video never has to fit in memory.
async function uploadVideo(userId, projectId, fileName, stream, contentType) {
  const bucketName = `user-${userId}`;
  await createBucket(bucketName);

  const videoKey = `${projectId}/video/${fileName}`;
  const upload = s3.upload({
    Bucket: bucketName,
    Key: videoKey,
    Body: stream,
    ContentType: contentType || "application/octet-stream",
  });

  // A sender that goes away mid-upload never ends the stream; abort instead of hanging.
  stream.on("aborted", () => upload.abort());

  try {
    const data = await upload.promise();
    return { videoKey, location: data.Location };
  } catch (error) {
    console.error("Erro ao enviar vídeo:", error.message);
    throw error;
  }
}

module.exports = uploadVideo;
