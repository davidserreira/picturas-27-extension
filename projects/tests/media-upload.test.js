// Streaming storage engine for project media (Phase 2, ADR-01), with
// img_storage replaced by fakes.
//
// Written with AI assistance (Claude Code) and validated by tests; see Docs/fase2/ia.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const multer = require('multer');
const { createMediaStorage } = require('../utils/mediaUpload');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function listen(storage) {
  const app = express();
  const upload = multer({ storage }).single('video');
  app.post('/:user/:project/video', (req, res) => upload(req, res, (err) => {
    if (err) return res.status(err.storageError ? 501 : 500).json({ error: err.message });
    res.json({ size: req.file.size, sha256: req.file.sha256, imageKey: req.file.imageKey });
  }));
  return new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
}

function multipart(payload, filename = 'clip.mp4', mime = 'video/mp4') {
  const boundary = `----test${crypto.randomBytes(6).toString('hex')}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, head, tail, length: head.length + payload.length + tail.length };
}

function open(server, payload, filename, mime) {
  const m = multipart(payload, filename, mime);
  const req = http.request({
    port: server.address().port, path: '/u1/p1/video', method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${m.boundary}`, 'Content-Length': m.length },
  });
  const response = new Promise((resolve, reject) => {
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error', reject);
  });
  return { req, m, response };
}

async function post(server, payload, filename, mime) {
  const { req, m, response } = open(server, payload, filename, mime);
  req.write(m.head); req.write(payload); req.end(m.tail);
  return response;
}

// Reads the multipart body that would go to img_storage.
function fakeStore(record, { failWith } = {}) {
  return (user, project, stage, form, { signal }) => new Promise((resolve, reject) => {
    record.calls = (record.calls ?? 0) + 1;
    record.args = { user, project, stage };
    record.signal = signal;
    const chunks = [];
    form.on('data', (c) => { chunks.push(Buffer.from(c)); record.bytes = (record.bytes ?? 0) + c.length; });
    form.on('end', () => {
      record.body = Buffer.concat(chunks);
      if (failWith) return reject(new Error(failWith));
      resolve({ data: { data: { imageKey: `${project}/src/stored.mp4` } } });
    });
    signal.addEventListener('abort', () => reject(new Error('aborted')));
    form.resume();
  });
}

test('the file is passed on to img_storage whole, with the same size and SHA-256 as the bytes sent', async () => {
  const record = {};
  const server = await listen(createMediaStorage({ store: fakeStore(record), remove: async () => {} }));
  try {
    const payload = crypto.randomBytes(3 * 1024 * 1024 + 5);
    const r = await post(server, payload);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { size: payload.length, sha256: sha(payload), imageKey: 'p1/src/stored.mp4' });
    assert.deepEqual(record.args, { user: 'u1', project: 'p1', stage: 'src' });
    assert.ok(record.body.includes(payload), 'the multipart body sent on contains the file');
    assert.match(record.body.toString('latin1'), /filename="clip\.mp4"\r\nContent-Type: video\/mp4/);
    assert.equal(record.signal.aborted, false);
  } finally { server.close(); }
});

test('a file the route will refuse by type is read and dropped, not stored', async () => {
  const record = {};
  const server = await listen(createMediaStorage({
    store: fakeStore(record), remove: async () => {}, accept: (file) => file.mimetype.startsWith('video/'),
  }));
  try {
    const payload = crypto.randomBytes(200000);
    const r = await post(server, payload, 'photo.png', 'image/png');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { size: payload.length, sha256: sha(payload), imageKey: null });
    assert.equal(record.calls, undefined);
  } finally { server.close(); }
});

test('a storage failure is marked so the route keeps its 501 answer', async () => {
  const record = {};
  const server = await listen(createMediaStorage({ store: fakeStore(record, { failWith: 'img_storage down' }), remove: async () => {} }));
  try {
    const r = await post(server, crypto.randomBytes(1024));
    assert.equal(r.status, 501);
    assert.equal(r.body.error, 'img_storage down');
  } finally { server.close(); }
});

test('a client that goes away midway cancels the request to img_storage', async () => {
  const record = {};
  const server = await listen(createMediaStorage({ store: fakeStore(record), remove: async () => {} }));
  try {
    const payload = crypto.randomBytes(8 * 1024 * 1024);
    const { req, m, response } = open(server, payload);
    response.catch(() => {}); // the request is destroyed on purpose
    req.write(m.head);
    req.write(payload.subarray(0, 2 * 1024 * 1024));
    for (let i = 0; i < 100 && !(record.bytes > 0); i++) await wait(20);
    assert.ok(record.bytes > 0, 'img_storage started receiving before the end of the upload');
    req.destroy();
    for (let i = 0; i < 100 && !record.signal.aborted; i++) await wait(20);
    assert.equal(record.signal.aborted, true);
    assert.equal(record.body, undefined, 'the body sent on never completed');
  } finally { server.close(); }
});

test('multer cleanup removes the stored file by its key', async () => {
  const removed = [];
  const storage = createMediaStorage({ store: async () => {}, remove: async (...a) => { removed.push(a); } });
  await new Promise((resolve, reject) => storage._removeFile(
    { params: { user: 'u1', project: 'p1' } }, { imageKey: 'p1/src/stored.mp4' }, (e) => (e ? reject(e) : resolve()),
  ));
  await new Promise((resolve) => storage._removeFile({ params: { user: 'u1', project: 'p1' } }, { imageKey: null }, resolve));
  assert.deepEqual(removed, [['u1', 'p1', 'src', 'stored.mp4']]);
});
