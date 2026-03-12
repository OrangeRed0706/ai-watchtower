const { readArtifact } = require("./artifact-reader");

module.exports = (() => {
  return readArtifact("digests.json") || [];
})();
