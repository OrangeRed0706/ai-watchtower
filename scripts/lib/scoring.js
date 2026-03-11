function safeLower(s) {
  return String(s || "").toLowerCase();
}

function parseIsoMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function urlPathHints(url) {
  const u = safeLower(url);
  return {
    hasChangelog: u.includes("/changelog/") || u.includes("changelog"),
    hasReleases: u.includes("/releases") || u.includes("releases."),
    hasSecurity: u.includes("/security") || u.includes("security"),
    hasPricing: u.includes("/pricing") || u.includes("pricing"),
    hasDocs: u.includes("/docs") || u.includes("docs.")
  };
}

function tierBonus(tier) {
  switch (String(tier || "").toLowerCase()) {
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

function recencyBonus(ageHours) {
  if (ageHours === null) return -8;
  if (ageHours <= 24) return 30;
  if (ageHours <= 72) return 22;
  if (ageHours <= 168) return 14;
  if (ageHours <= 336) return 8;
  if (ageHours <= 720) return 3;
  return 0;
}

function categoryBonus(category) {
  const c = safeLower(category);
  let bonus = 0;
  if (c.includes("model")) bonus += 6;
  if (c.includes("product")) bonus += 5;
  if (c.includes("tooling") || c.includes("framework") || c.includes("sdk")) bonus += 4;
  if (c.includes("policy") || c.includes("safety")) bonus += 4;
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

function titleHeuristics(title) {
  const t = String(title || "");
  const reasons = [];
  let delta = 0;

  for (const rule of TITLE_RULES) {
    if (rule.re.test(t)) {
      delta += rule.delta;
      reasons.push({ key: rule.key, delta: rule.delta });
    }
  }

  return { delta, reasons };
}

function pathHeuristics(url) {
  const hints = urlPathHints(url);
  const reasons = [];
  let delta = 0;

  if (hints.hasSecurity) {
    delta += 10;
    reasons.push({ key: "url:security", delta: 10 });
  }
  if (hints.hasReleases) {
    delta += 8;
    reasons.push({ key: "url:releases", delta: 8 });
  }
  if (hints.hasChangelog) {
    delta += 6;
    reasons.push({ key: "url:changelog", delta: 6 });
  }
  if (hints.hasPricing) {
    delta += 6;
    reasons.push({ key: "url:pricing", delta: 6 });
  }
  if (hints.hasDocs) {
    delta += 2;
    reasons.push({ key: "url:docs", delta: 2 });
  }

  return { delta, reasons };
}

function pickTimestampMs({ publishedAt, updatedAt }) {
  return parseIsoMs(publishedAt) ?? parseIsoMs(updatedAt) ?? null;
}

function limitReasons(reasons, { max = 12 } = {}) {
  const sorted = [...reasons].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return sorted.slice(0, max);
}

function scoreItem(item, { nowMs } = {}) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();

  const priority = item?.sourcePriority ?? null;
  const priorityBase = clampInt(priority ?? 50, 0, 100);
  const tier = item?.sourceTier || null;

  const tsMs = pickTimestampMs({ publishedAt: item?.publishedAt, updatedAt: item?.updatedAt });
  const ageHours = tsMs === null ? null : Math.max(0, (now - tsMs) / (1000 * 60 * 60));

  const reasons = [];
  let score = 0;

  const tierB = tierBonus(tier);
  score += tierB;
  reasons.push({ key: "source:tier", delta: tierB, note: tier || "unknown" });

  const prB = Math.round(priorityBase * 0.8);
  score += prB;
  reasons.push({
    key: "source:priority",
    delta: prB,
    note: priority === null ? "default=50" : String(priorityBase)
  });

  const recB = recencyBonus(ageHours);
  score += recB;
  reasons.push({
    key: "time:recency",
    delta: recB,
    note: ageHours === null ? "missing timestamp" : `${Math.round(ageHours)}h old`
  });

  const catB = categoryBonus(item?.category);
  if (catB) {
    score += catB;
    reasons.push({ key: "category:hint", delta: catB, note: String(item?.category || "") });
  }

  const t = titleHeuristics(item?.title);
  score += t.delta;
  reasons.push(...t.reasons);

  const p = pathHeuristics(item?.url);
  score += p.delta;
  reasons.push(...p.reasons);

  const finalScore = clampInt(score, -50, 200);
  return {
    score: finalScore,
    ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
    reasons: limitReasons(reasons, { max: 14 })
  };
}

module.exports = {
  scoreItem
};

