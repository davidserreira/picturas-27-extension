// ADR-02: work units, progress and public view of a processing run.
const test = require('node:test');
const assert = require('node:assert/strict');
const { runMedia, runProgress, runView, videoUnits } = require('../utils/runState');

const img = (id) => ({ _id: id, media_type: 'image' });
const vid = (id, duration, fps) => ({ _id: id, media_type: 'video', video: { duration, fps } });
const tool = (procedure, position) => ({ procedure, position, params: {} });

test('an image counts one unit per image tool; video-only tools do not count', () => {
  const media = runMedia({
    imgs: [img('a'), img('b')],
    tools: [tool('brightness', 0), tool('trim', 1), tool('contrast', 2)],
  });
  assert.deepEqual(media.map((m) => [m.img_id, m.kind, m.units]), [['a', 'image', 2], ['b', 'image', 2]]);
});

test('a video counts its frames; images are left out when there is no image tool', () => {
  const media = runMedia({ imgs: [vid('v', 330, 30), img('i')], tools: [tool('trim', 0)] });
  assert.deepEqual(media.map((m) => [m.img_id, m.kind, m.units]), [['v', 'video', 9900]]);
  assert.equal(videoUnits({ video: {} }), 1);
});

test('image-only run: steps done over total steps, as in the base', () => {
  const run = { status: 'running', media: [
    { kind: 'image', units: 2, done: 2 }, { kind: 'image', units: 2, done: 1 },
  ] };
  assert.equal(runProgress(run), 75);
});

test('mixed run follows the video, which holds almost all the work', () => {
  const run = { status: 'running', media: [
    { kind: 'video', units: 9900, percent: 40 },
    { kind: 'image', units: 2, done: 2 }, { kind: 'image', units: 2, done: 2 },
  ] };
  assert.equal(runProgress(run), 40);
  // (9900 x 0.4037 + 4) / 9904 = 40.39%, shown rounded down
  run.media[0].percent = 40.37;
  assert.equal(runProgress(run), 40.3);
});

test('progress is clamped, rounded down, and only reaches 100 when done', () => {
  const run = { status: 'running', media: [
    { kind: 'image', units: 1, done: 5 }, { kind: 'video', units: 100, percent: 150 },
  ] };
  assert.equal(runProgress(run), 99.9);
  assert.equal(runProgress({ ...run, status: 'done' }), 100);
  assert.equal(runProgress({ status: 'running', media: [] }), 0);
  assert.equal(runProgress({ status: 'running', media: [{ kind: 'image', units: 3, done: 1 }] }), 33.3);
});

test('view exposes the state without internal fields', () => {
  const view = runView({
    project_id: 'p', project_name: 'P', user_id: 'u', runner_id: 'r', token: 4, status: 'cancelled',
    media: [{ kind: 'image', units: 2, done: 1 }], started_at: 1, finished_at: 2, error: null,
  });
  assert.deepEqual(view, {
    projectId: 'p', projectName: 'P', ownerId: 'u', runnerId: 'r', token: 4, status: 'cancelled',
    progress: 50, startedAt: 1, finishedAt: 2, error: null,
  });
  assert.deepEqual(runView(null), { status: 'idle' });
});
