const fs = require("node:fs");
const path = require("node:path");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

module.exports = (() => {
  const artifactsPath = path.join(process.cwd(), "artifacts", "ingested.json");
  const legacyPath = path.join(process.cwd(), "src", "_data", "ingested.json");

  return readJsonIfExists(artifactsPath) || readJsonIfExists(legacyPath) || null;
})();

