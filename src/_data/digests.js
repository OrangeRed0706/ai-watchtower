const fs = require("node:fs");
const path = require("node:path");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

module.exports = (() => {
  const p = path.join(process.cwd(), "artifacts", "digests.json");
  return readJsonIfExists(p) || [];
})();
