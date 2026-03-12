import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const maxAgentsLines = 120;

const requiredFiles = [
  "AGENTS.md",
  "docs/agent/README.md",
  "docs/agent/context-map.md",
  "docs/agent/workflows.md",
  "docs/agent/testing.md",
  "docs/agent/change-checklist.md"
];

const errors: string[] = [];

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const agentsPath = resolve(repoRoot, "AGENTS.md");
if (existsSync(agentsPath)) {
  const lineCount = readFileSync(agentsPath, "utf8").split(/\r?\n/).length;
  if (lineCount > maxAgentsLines) {
    errors.push(`AGENTS.md must stay under ${maxAgentsLines} lines (found ${lineCount}).`);
  }
}

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath) || statSync(absolutePath).isDirectory()) {
    continue;
  }

  const content = readFileSync(absolutePath, "utf8");
  const markdownLinks = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  for (const [, target] of markdownLinks) {
    if (!target || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
      continue;
    }

    const cleanTarget = target.split("#")[0];
    const resolved = resolve(dirname(absolutePath), cleanTarget);
    if (!existsSync(resolved)) {
      errors.push(`Broken relative link in ${relativePath}: ${target}`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`Agent doc checks failed:\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write("Agent doc checks passed.\n");
