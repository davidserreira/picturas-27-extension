const MB = 1024 * 1024;
const GB = 1024 * MB;

// Video limits per user profile. The anonymous profile has no access to video.
const limits = {
  free: {
    maxSize: 200 * MB,
    maxDuration: 5 * 60,
    storage: 1 * GB,
    maxActiveImports: 1,
  },
  premium: {
    maxSize: 2 * GB,
    maxDuration: 30 * 60,
    storage: 10 * GB,
    maxActiveImports: 3,
  },
};

function limitsFor(userType) {
  return limits[userType] || null;
}

function formatBytes(bytes) {
  const value = Math.max(0, bytes);
  if (value >= GB) return `${+(value / GB).toFixed(1)} GB`;
  return `${+(value / MB).toFixed(1)} MB`;
}

function formatMinutes(seconds) {
  return `${Math.round(seconds / 60)} min`;
}

module.exports = { limits, limitsFor, formatBytes, formatMinutes };
