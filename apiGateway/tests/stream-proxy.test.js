// Streaming upload proxy of the gateway (Phase 2, ADR-01), against a local
// HTTPS server that plays the projects service. Run: node --test tests/
//
// Written with AI assistance (Claude Code) and validated by tests; see Docs/fase2/ia.md.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET_KEY = "stream-proxy-test";
const auth = require("../auth/auth");
const { streamToProjects, answerAfterBody } = require("../utils/streamProxy");

const certs = path.join(__dirname, "..", "certs");
const tls = { key: fs.readFileSync(path.join(certs, "selfsigned.key")), cert: fs.readFileSync(path.join(certs, "selfsigned.crt")) };
const agent = new https.Agent({ rejectUnauthorized: false });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (id) => jwt.sign({ id, exp: Math.floor(Date.now() / 1000) + 600 }, process.env.JWT_SECRET_KEY);

// Fake projects service: `handler(req, res, body)` gets the request after reading
// it, unless it answers early through `onRequest`.
function fakeProjects({ onRequest, handler }) {
  const seen = { requests: [] };
  const server = https.createServer(tls, (req, res) => {
    const rec = { method: req.method, url: req.url, headers: req.headers, bytes: 0, complete: false };
    seen.requests.push(rec);
    const hash = crypto.createHash("sha256");
    req.on("data", (c) => { rec.bytes += c.length; hash.update(c); });
    req.on("close", () => { rec.closed = true; });
    if (onRequest && onRequest(req, res, rec)) return;
    req.on("end", () => { rec.complete = true; rec.sha256 = hash.digest("hex"); handler(req, res, rec); });
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, seen, url: `https://localhost:${server.address().port}/` })));
}

function gateway(projectsURL) {
  const app = express();
  app.use(express.json());
  app.post("/projects/:user/:project/video", answerAfterBody(auth.checkToken), streamToProjects({ projectsURL, agent, endpoint: "video" }));
  return new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
}

function send(server, { path: p, headers = {}, body, abortAfter }) {
  return new Promise((resolve, reject) => {
    const t = { lastByte: null };
    const req = http.request({ port: server.address().port, path: p, method: "POST", headers: { "Content-Length": body.length, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString(), answeredAfterLastByte: t.lastByte !== null }));
    });
    req.on("error", (e) => (abortAfter ? resolve({ aborted: true }) : reject(e)));
    req.on("finish", () => { t.lastByte = Date.now(); });
    if (abortAfter) {
      req.write(body.subarray(0, abortAfter));
      setTimeout(() => req.destroy(), 300);
      return;
    }
    // Send in slices so an early answer would arrive before the end of the body.
    let i = 0;
    const step = 256 * 1024;
    (function next() {
      if (i >= body.length) return req.end();
      const ok = req.write(body.subarray(i, i + step));
      i += step;
      if (ok) setImmediate(next); else req.once("drain", next);
    })();
  });
}

const multipartType = "multipart/form-data; boundary=----abc";

test("the body reaches projects unchanged, with the same headers, and success answers 204 with the version", async () => {
  const fake = await fakeProjects({ handler: (req, res) => { res.setHeader("X-Project-Version", "7"); res.statusCode = 204; res.end(); } });
  const gw = await gateway(fake.url);
  try {
    const body = crypto.randomBytes(5 * 1024 * 1024);
    const r = await send(gw, {
      path: "/projects/u1/p1/video?share=s%201",
      headers: { "Content-Type": multipartType, Authorization: `Bearer ${token("u1")}`, "X-Project-Version": "6" },
      body,
    });
    assert.equal(r.status, 204);
    assert.equal(r.headers["x-project-version"], "7");
    const seen = fake.seen.requests[0];
    assert.equal(seen.url, "/u1/p1/video?share=s%201");
    assert.equal(seen.sha256, crypto.createHash("sha256").update(body).digest("hex"));
    assert.equal(seen.headers["content-type"], multipartType);
    assert.equal(seen.headers["content-length"], String(body.length));
    assert.equal(seen.headers["x-project-version"], "6");
    assert.equal(seen.headers["x-caller-id"], "u1");
    assert.match(seen.headers.authorization, /^Bearer /);
  } finally { gw.close(); fake.server.close(); }
});

test("an error from projects is answered with the same status, body and version", async () => {
  const fake = await fakeProjects({ handler: (req, res) => {
    res.writeHead(409, { "Content-Type": "application/json", "X-Project-Version": "3" });
    res.end(JSON.stringify({ message: "Project version conflict", serverVersion: 3 }));
  } });
  const gw = await gateway(fake.url);
  try {
    const r = await send(gw, { path: "/projects/u1/p1/video", headers: { "Content-Type": multipartType, Authorization: `Bearer ${token("u1")}`, "X-Project-Version": "2" }, body: crypto.randomBytes(1024) });
    assert.equal(r.status, 409);
    assert.equal(r.headers["x-project-version"], "3");
    assert.deepEqual(JSON.parse(r.text), { message: "Project version conflict", serverVersion: 3 });
  } finally { gw.close(); fake.server.close(); }
});

test("an early answer from projects reaches the client only after the whole body was sent", async () => {
  const fake = await fakeProjects({ onRequest: (req, res) => { res.writeHead(428, { "Content-Type": "application/json" }); res.end(JSON.stringify("Missing X-Project-Version header")); return true; } });
  const gw = await gateway(fake.url);
  try {
    const r = await send(gw, { path: "/projects/u1/p1/video", headers: { "Content-Type": multipartType, Authorization: `Bearer ${token("u1")}` }, body: crypto.randomBytes(20 * 1024 * 1024) });
    assert.equal(r.status, 428);
    assert.equal(JSON.parse(r.text), "Missing X-Project-Version header");
    assert.equal(r.answeredAfterLastByte, true);
  } finally { gw.close(); fake.server.close(); }
});

test("projects down answers 500 \"Projects service unavailable\"", async () => {
  const fake = await fakeProjects({ handler: () => {} });
  const url = fake.url;
  await new Promise((r) => fake.server.close(r));
  const gw = await gateway(url);
  try {
    const r = await send(gw, { path: "/projects/u1/p1/video", headers: { "Content-Type": multipartType, Authorization: `Bearer ${token("u1")}` }, body: crypto.randomBytes(1024) });
    assert.equal(r.status, 500);
    assert.equal(JSON.parse(r.text), "Projects service unavailable");
  } finally { gw.close(); }
});

test("a missing or invalid JWT is refused with 401 without contacting projects", async () => {
  const fake = await fakeProjects({ handler: (req, res) => { res.statusCode = 204; res.end(); } });
  const gw = await gateway(fake.url);
  try {
    const body = crypto.randomBytes(8 * 1024 * 1024);
    const none = await send(gw, { path: "/projects/u1/p1/video", headers: { "Content-Type": multipartType }, body });
    assert.equal(none.status, 401);
    assert.equal(JSON.parse(none.text), "Please provide a JWT token");
    assert.equal(none.answeredAfterLastByte, true);
    const other = await send(gw, { path: "/projects/u1/p1/video", headers: { "Content-Type": multipartType, Authorization: `Bearer ${token("u2")}` }, body });
    assert.equal(other.status, 401);
    assert.equal(JSON.parse(other.text), "Request's user and JWT's user don't match");
    assert.equal(fake.seen.requests.length, 0);
  } finally { gw.close(); fake.server.close(); }
});

test("a client that goes away midway cancels the request to projects", async () => {
  const fake = await fakeProjects({ handler: (req, res) => { res.statusCode = 204; res.end(); } });
  const gw = await gateway(fake.url);
  try {
    const body = crypto.randomBytes(8 * 1024 * 1024);
    const r = await send(gw, { path: "/projects/u1/p1/video", headers: { "Content-Type": multipartType, Authorization: `Bearer ${token("u1")}` }, body, abortAfter: 2 * 1024 * 1024 });
    assert.equal(r.aborted, true);
    for (let i = 0; i < 100 && !fake.seen.requests[0]?.closed; i++) await wait(20);
    const seen = fake.seen.requests[0];
    assert.ok(seen.bytes > 0, "projects started receiving before the end of the upload");
    assert.equal(seen.closed, true);
    assert.equal(seen.complete, false);
  } finally { gw.close(); fake.server.close(); }
});
