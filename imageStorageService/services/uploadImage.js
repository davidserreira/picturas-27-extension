const s3 = require("./s3Client");
const { BUCKET, objectKey, ensureBucket } = require("./storage");
const { v4: uuidv4 } = require("uuid");

// The file arrives as a stream (see streamStorage.js) and is sent as an S3
// multipart upload. The SDK keeps at most QUEUE_SIZE parts of PART_SIZE bytes in
// memory, so memory use no longer grows with the file size (Phase 2, ADR-01).
const PART_SIZE = 5 * 1024 * 1024; // smallest part size S3 accepts
// Parts sent in parallel. 2 rather than the SDK default of 4: half the parts
// held in memory, with the same upload time to the local SeaweedFS (measured
// in Docs/fase2/medicoes/passos/afinacao/).
const QUEUE_SIZE = 2;

async function uploadImage(userId, projectId, file, stage, { onStart } = {}) {
  await ensureBucket();

  // imageKey is what callers store and send back (<projectId>/<stage>/<file>);
  // the user prefix is added only for the object's key in the shared bucket.
  const fileName = `${uuidv4()}.${file.mimetype.split("/")[1]}`;
  const imageKey = `${projectId}/${stage}/${fileName}`;
  const params = {
    Bucket: BUCKET,
    Key: objectKey(userId, projectId, stage, fileName),
    Body: file.stream,
    ContentType: file.mimetype,
  };

  try {
    const upload = s3.upload(params, { partSize: PART_SIZE, queueSize: QUEUE_SIZE });
    if (onStart) onStart(upload);
    const data = await upload.promise();
    return { imageKey, location: data.Location };
  } catch (error) {
    console.error("Erro ao enviar imagem:", error.message);
    throw error;
  }
}

module.exports = uploadImage;
