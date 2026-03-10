/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.addFilter("prettyDate", (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(`${isoDate}T00:00:00Z`);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit"
    }).format(d);
  });

  eleventyConfig.addFilter("impactClass", (impactLevel) => {
    const v = String(impactLevel || "").toLowerCase();
    if (v === "high") return "badge badge--high";
    if (v === "medium") return "badge badge--medium";
    if (v === "low") return "badge badge--low";
    return "badge";
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "public"
    },
    pathPrefix: (() => {
      const raw = process.env.ELEVENTY_PATH_PREFIX;
      if (!raw) return "/";
      if (raw === "/") return "/";
      const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
      return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
    })(),
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
