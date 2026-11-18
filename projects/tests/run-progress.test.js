const test = require('node:test');
const assert = require('node:assert/strict');
const { runUnits, runPercent, serializeRun } = require('../utils/runProgress');

test('images count one unit per image tool and videos count their duration', () => {
  const jobs = [
    { isVideo: false, imgId: 'i1' },
    { isVideo: false, imgId: 'i2' },
    { isVideo: true, imgId: 'v1', duration: 29.6 },
    { isVideo: true, imgId: 'v2', duration: 0 },
  ];
  assert.deepEqual(runUnits(jobs, 3), { units_total: 6 + 30 + 1, video_weights: { v1: 30, v2: 1 } });
  assert.equal(runUnits([], 2).units_total, 1);
});

test('percent combines image steps with the reported video percentage', () => {
  const run = { state: 'running', units_total: 40, units_done: 4, video_weights: { v: 36 }, video_percent: { v: 50 } };
  assert.equal(runPercent(run), 55); // (4 + 18) / 40
});

test('one percent of a long video changes the overall value', () => {
  const base = { state: 'running', units_total: 334, units_done: 0, video_weights: { v: 330 } };
  const a = runPercent({ ...base, video_percent: { v: 40 } });
  const b = runPercent({ ...base, video_percent: { v: 41 } });
  assert.ok(b > a, `${a} -> ${b}`);
});

test('a running run never shows 100 % and a completed one always does', () => {
  const almost = { state: 'running', units_total: 2, units_done: 2, video_weights: {}, video_percent: {} };
  assert.equal(runPercent(almost), 99.9);
  assert.equal(runPercent({ ...almost, units_done: 0, state: 'completed' }), 100);
});

test('serialized run exposes only what the browser needs', () => {
  const s = serializeRun({ project_id: 'p', user_id: 'u', project_name: 'P', runner_id: null, token: 3, state: 'cancelled', units_total: 1, units_done: 0 });
  assert.equal(s.projectId, 'p');
  assert.equal(s.ownerId, 'u');
  assert.equal(s.state, 'cancelled');
  assert.equal(s.percent, 0);
  assert.equal(serializeRun(null), null);
});
