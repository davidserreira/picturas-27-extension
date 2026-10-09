const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const requireGateway = createRequire(path.resolve(__dirname, "../../apiGateway/package.json"));
const express = requireGateway("express");
const jwt = requireGateway("jsonwebtoken");
process.env.JWT_SECRET_KEY = "uc-vid-003-test-only";
let forwarded = [], server, url;
const axiosPath = requireGateway.resolve("axios");
requireGateway("axios");
require.cache[axiosPath].exports = async (request) => {
  forwarded.push(request);
  return { status: 202, data: { job: { tool: "apply", state: "queued" } } };
};
const router = requireGateway("./routes/videos");
before(async () => {
  const app = express(); app.use(express.json()); app.use("/projects", router);
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  url = `http://127.0.0.1:${server.address().port}/projects/user/project/videos/video/apply`;
});
beforeEach(() => { forwarded = []; });
after(async () => { await new Promise((resolve) => server.close(resolve)); });
async function submit(token) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ tools: [{ type: "rotate", degrees: 90 }] }) });
}
test("a valid owner's JWT forwards APPLY with its body and verified caller", async () => {
  const token = jwt.sign({ id: "user" }, process.env.JWT_SECRET_KEY, { expiresIn: "1h" });
  const response = await submit(token);
  assert.equal(response.status, 202); assert.equal((await response.json()).job.tool, "apply");
  assert.equal(forwarded.length, 1); assert.equal(forwarded[0].url, "https://projects:9001/user/project/videos/video/apply");
  assert.equal(forwarded[0].headers["X-Caller-Id"], "user");
  assert.deepEqual(forwarded[0].data.tools, [{ type: "rotate", degrees: 90 }]);
});
test("a missing JWT never reaches the projects service", async () => {
  assert.equal((await submit()).status, 401); assert.equal(forwarded.length, 0);
});
test("an expired JWT never reaches the projects service", async () => {
  assert.equal((await submit(jwt.sign({ id: "user" }, process.env.JWT_SECRET_KEY, { expiresIn: -1 }))).status, 401);
  assert.equal(forwarded.length, 0);
});
test("another user's JWT never reaches the projects service", async () => {
  assert.equal((await submit(jwt.sign({ id: "another" }, process.env.JWT_SECRET_KEY, { expiresIn: "1h" }))).status, 401);
  assert.equal(forwarded.length, 0);
});
