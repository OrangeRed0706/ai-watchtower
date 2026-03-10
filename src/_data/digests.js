module.exports = [
  {
    date: "2026-03-10",
    title: "Daily digest",
    summary:
      "A few representative items across models, products, and tooling. This page demonstrates layout, labels, and provenance links.",
    items: [
      {
        title: "Example: New model capability announced",
        url: "https://example.com/model-capability",
        sources: [
          { name: "OpenAI Blog (mock)", url: "https://example.com/source/openai" },
          { name: "Secondary write-up (mock)", url: "https://example.com/source/secondary" }
        ],
        impactArea: "model",
        impactLevel: "high",
        tags: ["models", "release"],
        summary:
          "A mock announcement describing improved reasoning and lower latency for a new model variant.",
        whyItMatters:
          "Higher capability at the same cost changes what workflows are feasible to automate and where latency-sensitive UX becomes viable."
      },
      {
        title: "Example: Product update improves eval tooling",
        url: "https://example.com/eval-tooling",
        sources: [{ name: "GitHub Changelog (mock)", url: "https://example.com/source/github" }],
        impactArea: "tooling",
        impactLevel: "medium",
        tags: ["tooling", "evaluation"],
        summary:
          "A mock tooling update adds better diffing and provenance export for evaluation runs.",
        whyItMatters:
          "Better evaluation primitives make it easier to ship model changes safely and understand regressions."
      },
      {
        title: "Example: Career signal — hiring trend note",
        url: "https://example.com/career-signal",
        sources: [{ name: "Industry blog (mock)", url: "https://example.com/source/industry" }],
        impactArea: "career",
        impactLevel: "low",
        tags: ["career", "market"],
        summary:
          "A mock observation about increasing demand for evaluation and safety engineering roles.",
        whyItMatters:
          "Signals where organizations are investing and which skills may have compounding value."
      }
    ]
  },
  {
    date: "2026-03-09",
    title: "Daily digest",
    summary:
      "A second mock digest used to demonstrate archive navigation and previous/next links.",
    items: [
      {
        title: "Example: Product policy clarification",
        url: "https://example.com/policy-clarification",
        sources: [{ name: "Anthropic News (mock)", url: "https://example.com/source/anthropic" }],
        impactArea: "product",
        impactLevel: "medium",
        tags: ["policy", "product"],
        summary: "A mock update clarifies usage limits and data retention behavior.",
        whyItMatters:
          "Policy and retention details affect vendor selection, compliance posture, and user trust."
      },
      {
        title: "Example: Tooling — CLI update",
        url: "https://example.com/cli-update",
        sources: [{ name: "GitHub Changelog (mock)", url: "https://example.com/source/github-2" }],
        impactArea: "tooling",
        impactLevel: "low",
        tags: ["tooling"],
        summary:
          "A mock CLI update improves auth ergonomics and adds a new subcommand.",
        whyItMatters:
          "Small tooling improvements compound over time and reduce friction for daily workflows."
      }
    ]
  }
];

