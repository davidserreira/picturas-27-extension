// ADR-02: who receives the state of a processing run.
const test = require("node:test");
const assert = require("node:assert/strict");
const { runStatusRooms } = require("../utils/runStatus");

test("owner and runner rooms, once each", () => {
  assert.deepEqual(runStatusRooms({ projectId: "p", ownerId: "u1", runnerId: "u2" }), ["u1", "u2"]);
  assert.deepEqual(runStatusRooms({ projectId: "p", ownerId: "u1", runnerId: "u1" }), ["u1"]);
  assert.deepEqual(runStatusRooms({ projectId: "p", ownerId: "u1", runnerId: null }), ["u1"]);
});

test("never the project room, which has no access check", () => {
  const rooms = runStatusRooms({ projectId: "p", ownerId: "u1", runnerId: "u2" });
  assert.ok(!rooms.some((r) => r.startsWith("project:")));
});

test("a message without a project or a run is ignored", () => {
  assert.deepEqual(runStatusRooms(undefined), []);
  assert.deepEqual(runStatusRooms({ ownerId: "u1" }), []);
  assert.deepEqual(runStatusRooms({ projectId: "", ownerId: "u1" }), []);
});
