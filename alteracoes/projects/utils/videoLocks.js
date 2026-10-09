// Shared by imports, tool submissions and publication of completed results.
// This serializes checks in the single projects service used by this MVP.
const locks = new Map();

function withUserLock(userId, fn) {
  const key = String(userId);
  const previous = locks.get(key) || Promise.resolve();
  const result = previous.then(fn);
  const tail = result.catch(() => {});
  locks.set(key, tail);
  tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return result;
}

module.exports = { withUserLock };
