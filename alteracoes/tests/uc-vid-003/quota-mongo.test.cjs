// Enabled by CI's disposable MongoDB 4.4 service. No production data is used.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

test("MongoDB refunds once under concurrency, on the reservation day", {
  skip: !process.env.MONGODB_TEST_URL,
}, async () => {
  const requireUsers = createRequire(path.resolve(__dirname, "../../users/package.json"));
  process.env.FIELD_ENCRYPTION_KEY = "uc-vid-003-test-only";
  const mongoose = requireUsers("mongoose");
  const User = requireUsers("./models/user");
  const yesterday = new Date("2026-10-08T00:00:00Z");
  const today = new Date("2026-10-09T00:00:00Z");
  const key = "100000000000000000000001";
  let fixture;
  try {
    await mongoose.connect(process.env.MONGODB_TEST_URL, { dbName: "uc_vid_003_test", serverSelectionTimeoutMS: 5000 });
    fixture = await User.create({ name: "UC-VID-003 fixture", type: "free", email: `quota-${Date.now()}@example.test`,
      operations: [{ day: yesterday, processed: 3 }, { day: today, processed: 1 }] });
    await Promise.all(Array.from({ length: 20 }, () => User.refundVideoOperation(fixture._id, key, yesterday, 1)));
    const result = await User.findById(fixture._id).lean();
    assert.deepEqual(result.operations.map((operation) => operation.processed), [2, 1]);
    assert.deepEqual(result.video_refunds, [key]);
    assert.equal(Object.hasOwn((await User.findById(fixture._id)).toJSON(), "video_refunds"), false);
    await User.refundVideoOperation(fixture._id, "100000000000000000000002", today, 1);
    assert.deepEqual((await User.findById(fixture._id).lean()).operations.map((operation) => operation.processed), [2, 0]);
  } finally {
    if (fixture) await User.deleteOne({ _id: fixture._id });
    await mongoose.disconnect();
  }
});
