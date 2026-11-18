// Rooms that receive the state of a processing run (ADR-02, Docs/fase2/adr/):
// the project owner and the user who started the run (a shared editor). Both
// are user rooms, joined only with a valid JWT. The "project:<id>" room is left
// out on purpose: any socket can join it without an access check.
function runStatusRooms(run) {
  if (!run || typeof run.projectId !== "string" || run.projectId.length === 0) return [];
  const rooms = [run.ownerId, run.runnerId].filter((r) => typeof r === "string" && r.length > 0);
  return [...new Set(rooms)];
}

module.exports = { runStatusRooms };
