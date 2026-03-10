const digests = require("./digests");

function sortNewestFirst(a, b) {
  return String(b.date).localeCompare(String(a.date));
}

module.exports = {
  latestDigest: [...digests].sort(sortNewestFirst)[0] || null,
  allDigests: [...digests].sort(sortNewestFirst)
};

