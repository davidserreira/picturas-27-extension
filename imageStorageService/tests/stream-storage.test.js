// Streaming upload route of img_storage (Phase 2, ADR-01), with S3 replaced by
// fakes. Run inside the img_storage image: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");

// Replace the S3-backed services before the route loads them.
let uploadImpl;
let removed = [];
function stub(relPath, exportsValue) {
  const p = require.resolve(relPath);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exportsValue };
}
stub("../services/uploadImage", (...args) => uploadImpl(...args));
stub("../services/deleteFile", async (...args) => { removed.push(args); });
const router = require("../route/upload");

const app = express();
app.use("/upload", router);

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function multipart(payload, { field = "file", filename = "clip.mp4", mime = "video/mp4" } = {}) {
  const boundary = `----test${crypto.randomBytes(6).toString("hex")}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, head, tail, length: head.length + payload.length + tail.length };
}

function post(server, path, payload, opts) {
  const { boundary, head, tail, length } = multipart(payload, opts);
  return new Promise((resolve, reject) => {
    const req = http.request({
      port: server.address().port, path, method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": length },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on("error", reject);
    req.write(head);
    req.write(payload);
    req.end(tail);
  });
}

// Consumes the stream like the S3 SDK would, recording hash and size.
function hashingUpload(record) {
  return (userId, projectId, file, stage, { onStart }) => new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    let size = 0;
    const handle = { aborted: false, abort() { this.aborted = true; file.stream.destroy(); reject(new Error("aborted")); } };
    record.handle = handle;
    record.args = { userId, projectId, stage, mimetype: file.mimetype };
    onStart(handle);
    file.stream.on("data", (c) => { size += c.length; hash.update(c); record.bytes = size; });
    file.stream.on("end", () => {
      record.sha256 = hash.digest("hex");
      record.size = size;
      resolve({ imageKey: `${projectId}/${stage}/x.mp4`, location: "http://s3/x.mp4" });
    });
    file.stream.on("error", reject);
  });
}

test("the file reaches storage byte for byte and the answer keeps its shape", async () => {
  const server = await listen();
  try {
    const record = {};
    uploadImpl = hashingUpload(record);
    const payload = crypto.randomBytes(3 * 1024 * 1024 + 17);
    const r = await post(server, "/upload/u1/p1/src", payload);
    assert.equal(r.status, 201);
    assert.deepEqual(r.body, {
      message: "Imagem enviada com sucesso!",
      data: { imageKey: "p1/src/x.mp4", location: "http://s3/x.mp4" },
    });
    assert.equal(record.size, payload.length);
    assert.equal(record.sha256, crypto.createHash("sha256").update(payload).digest("hex"));
    assert.deepEqual(record.args, { userId: "u1", projectId: "p1", stage: "src", mimetype: "video/mp4" });
  } finally {
    server.close();
  }
});

test("an invalid stage is refused before anything is stored", async () => {
  const server = await listen();
  try {
    let called = false;
    uploadImpl = async () => { called = true; };
    const r = await post(server, "/upload/u1/p1/nope", Buffer.from("x"));
    assert.equal(r.status, 400);
    assert.match(r.body.error, /src, preview, preview_cache ou out/);
    assert.equal(called, false);
  } finally {
    server.close();
  }
});

test("a storage failure answers 500 with the error message, as before", async () => {
  const server = await listen();
  try {
    uploadImpl = (u, p, file) => new Promise((resolve, reject) => {
      file.stream.resume();
      file.stream.on("end", () => reject(new Error("S3 is down")));
    });
    const r = await post(server, "/upload/u1/p1/out", crypto.randomBytes(1024));
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: "S3 is down" });
  } finally {
    server.close();
  }
});

test("a client that goes away midway aborts the storage upload", async () => {
  const server = await listen();
  try {
    const record = {};
    uploadImpl = hashingUpload(record);
    const payload = crypto.randomBytes(8 * 1024 * 1024);
    const { boundary, head, length } = multipart(payload);
    const req = http.request({
      port: server.address().port, path: "/upload/u1/p1/src", method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": length },
    });
    req.on("error", () => {});
    req.write(head);
    req.write(payload.subarray(0, 2 * 1024 * 1024));
    for (let i = 0; i < 100 && !(record.bytes > 0); i++) await new Promise((r) => setTimeout(r, 20));
    assert.ok(record.bytes > 0, "storage started before the end of the body");
    req.destroy();
    for (let i = 0; i < 100 && !record.handle.aborted; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(record.handle.aborted, true);
    assert.equal(record.sha256, undefined, "the upload never completed");
  } finally {
    server.close();
  }
});
