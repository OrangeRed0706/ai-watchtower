const { readArtifact } = require("./artifact-reader");

module.exports = (() => {
  const artifact = readArtifact("dedup-groups.json");
  return artifact ? { available: true, ...artifact } : { available: false, groups: [], stats: null, generatedAt: null };
})();
