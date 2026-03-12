const fs = require("node:fs");
const path = require("node:path");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readArtifact(name) {
  return readJsonIfExists(path.join(process.cwd(), "artifacts", name));
}

module.exports = {
  readArtifact
};
