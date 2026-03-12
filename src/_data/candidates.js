const { readArtifact } = require("./artifact-reader");

module.exports = (() => {
  const artifact = readArtifact("candidates.json");
  return artifact ? { available: true, ...artifact } : { available: false, items: [], totalItems: 0, topCount: 0 };
})();
