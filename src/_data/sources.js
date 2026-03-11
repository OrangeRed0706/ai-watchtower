const fs = require("node:fs");
const path = require("node:path");

function loadConfiguredSources() {
  const configPath = path.join(process.cwd(), "config", "sources.json");
  if (!fs.existsSync(configPath)) return null;

  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const sources = Array.isArray(parsed?.sources) ? parsed.sources : null;
  if (!sources) return null;

  return sources
    .filter((s) => s && s.enabled !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      url: s.siteUrl,
      feedUrl: s.feedUrl,
      category: s.category,
      tier: s.tier || null,
      priority: s.priority ?? null,
      sourceType: s.sourceType || null,
      fetchPolicy: s.fetchPolicy || null,
      notes: s.notes
    }));
}

module.exports =
  loadConfiguredSources() || [
    {
      id: "openai-blog",
      name: "OpenAI Blog",
      url: "https://openai.com/blog",
      category: "Model / Product",
      tier: "official",
      priority: 95,
      sourceType: "vendor_blog",
      fetchPolicy: "feed",
      notes: "Official updates and announcements."
    },
    {
      id: "anthropic-news",
      name: "Anthropic News",
      url: "https://www.anthropic.com/news",
      category: "Model / Safety",
      tier: "official",
      priority: 90,
      sourceType: "vendor_news",
      fetchPolicy: "manual",
      notes: "Official releases and research posts."
    },
    {
      id: "github-changelog",
      name: "GitHub Changelog",
      url: "https://github.blog/changelog/",
      category: "Tooling",
      tier: "primary",
      priority: 70,
      sourceType: "changelog",
      fetchPolicy: "feed",
      notes: "Product updates that affect developer workflows."
    }
  ];
