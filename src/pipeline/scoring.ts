import type { ScoreReason } from "../contracts/artifacts";

function safeLower(input: string | null | undefined): string {
  return String(input || "").toLowerCase();
}

function parseIsoMs(input: string | null | undefined): number | null {
  if (!input) return null;
  const ms = Date.parse(String(input));
  return Number.isFinite(ms) ? ms : null;
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return min;
  return Math.max(min, Math.min(max, rounded));
}

function tierBonus(tier: string | null | undefined): number {
  switch (safeLower(tier)) {
    case "primary":
      return 30;
    case "official":
      return 20;
    case "reference":
      return 14;
    case "secondary":
      return 6;
    default:
      return 12;
  }
}

function recencyBonus(ageHours: number | null): number {
  if (ageHours === null) return -8;
  if (ageHours <= 24) return 30;
  if (ageHours <= 72) return 22;
  if (ageHours <= 168) return 14;
  if (ageHours <= 336) return 8;
  if (ageHours <= 720) return 3;
  return 0;
}

function categoryBonus(category: string | null | undefined): number {
  const lower = safeLower(category);
  let bonus = 0;
  if (lower.includes("model")) bonus += 6;
  if (lower.includes("product")) bonus += 5;
  if (lower.includes("tooling") || lower.includes("framework") || lower.includes("sdk")) bonus += 4;
  if (lower.includes("policy") || lower.includes("safety")) bonus += 4;
  return bonus;
}

const TITLE_RULES = [
  { key: "title:release", re: /\brelease\b|\breleased\b|\brelease notes\b/i, delta: 14 },
  { key: "title:changelog", re: /\bchangelog\b/i, delta: 12 },
  { key: "title:announce", re: /\bannounce|\bannouncement\b|\bintroducing\b|\blaunch\b/i, delta: 10 },
  { key: "title:ga", re: /\bgeneral availability\b|\bga\b/i, delta: 10 },
  { key: "title:preview", re: /\bpreview\b|\bbeta\b|\bearly access\b/i, delta: 6 },
  { key: "title:breaking", re: /\bbreaking\b|\bdeprecat|\bmigration\b|\bmigrate\b/i, delta: 10 },
  { key: "title:security", re: /\bsecurity\b|\bvulnerability\b|\bcve-\d+/i, delta: 14 },
  { key: "title:pricing", re: /\bpricing\b|\bcost\b|\brate limit\b|\bquota\b/i, delta: 10 },
  { key: "title:sdk", re: /\bsdk\b|\bapi\b|\bclient library\b/i, delta: 6 },
  { key: "title:benchmark", re: /\beval\b|\bevaluation\b|\bbenchmark\b/i, delta: 7 },
  { key: "title:policy", re: /\bpolicy\b|\bterms\b|\bcompliance\b/i, delta: 7 },
  { key: "title:roundup", re: /\broundup\b|\bweekly\b|\bnewsletter\b/i, delta: -6 },
  { key: "title:event", re: /\bwebinar\b|\bmeetup\b|\bconference\b|\bpodcast\b/i, delta: -5 }
];

function urlPathHints(url: string | null | undefined): Record<string, boolean> {
  const lower = safeLower(url);
  return {
    hasChangelog: lower.includes("/changelog/") || lower.includes("changelog"),
    hasReleases: lower.includes("/releases") || lower.includes("releases."),
    hasSecurity: lower.includes("/security") || lower.includes("security"),
    hasPricing: lower.includes("/pricing") || lower.includes("pricing"),
    hasDocs: lower.includes("/docs") || lower.includes("docs.")
  };
}

function limitReasons(reasons: ScoreReason[], max = 14): ScoreReason[] {
  return [...reasons].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, max);
}

export function scoreItem(
  item: {
    title?: string | null;
    url?: string | null;
    publishedAt?: string | null;
    updatedAt?: string | null;
    sourcePriority?: number | null;
    sourceTier?: string | null;
    category?: string | null;
  },
  options: { nowIso?: string } = {}
): { score: number; ageHours: number | null; reasons: ScoreReason[] } {
  const nowMs = parseIsoMs(options.nowIso) ?? Date.now();
  const priorityBase = clampInt(item.sourcePriority ?? 50, 0, 100);
  const tsMs = parseIsoMs(item.publishedAt) ?? parseIsoMs(item.updatedAt);
  const ageHours = tsMs === null ? null : Math.max(0, (nowMs - tsMs) / (1000 * 60 * 60));

  const reasons: ScoreReason[] = [];
  let score = 0;

  const tier = tierBonus(item.sourceTier);
  score += tier;
  reasons.push({ key: "source:tier", delta: tier, note: item.sourceTier ?? "unknown" });

  const priority = Math.round(priorityBase * 0.8);
  score += priority;
  reasons.push({ key: "source:priority", delta: priority, note: String(priorityBase) });

  const recency = recencyBonus(ageHours);
  score += recency;
  reasons.push({
    key: "time:recency",
    delta: recency,
    note: ageHours === null ? "missing timestamp" : `${Math.round(ageHours)}h old`
  });

  const category = categoryBonus(item.category);
  if (category) {
    score += category;
    reasons.push({ key: "category:hint", delta: category, note: item.category ?? "" });
  }

  for (const rule of TITLE_RULES) {
    if (rule.re.test(String(item.title || ""))) {
      score += rule.delta;
      reasons.push({ key: rule.key, delta: rule.delta });
    }
  }

  const hints = urlPathHints(item.url);
  if (hints.hasSecurity) reasons.push({ key: "url:security", delta: 10 });
  if (hints.hasReleases) reasons.push({ key: "url:releases", delta: 8 });
  if (hints.hasChangelog) reasons.push({ key: "url:changelog", delta: 6 });
  if (hints.hasPricing) reasons.push({ key: "url:pricing", delta: 6 });
  if (hints.hasDocs) reasons.push({ key: "url:docs", delta: 2 });
  score += reasons
    .filter((reason) => reason.key.startsWith("url:"))
    .reduce((sum, reason) => sum + reason.delta, 0);

  return {
    score: clampInt(score, -50, 200),
    ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
    reasons: limitReasons(reasons)
  };
}
