import { MetadataRoute } from "next";

// Everything public is crawlable (that explicitly includes the AI answer
// engines — GPTBot, ClaudeBot, PerplexityBot, Google-Extended — which the
// wildcard covers). The disallow list is the API plus the account-only and
// throwaway areas: signed-in tools, the Spy/Explore views, ephemeral share
// links, and the internal test harness. Those are already noindex via page
// metadata; keeping them out of the crawl saves crawl budget for the pages
// that matter (the app, Drum School, Songs, About).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/my", "/spy", "/explore", "/auth/", "/p/", "/test"],
      },
    ],
    sitemap: "https://rockblocks.app/sitemap.xml",
    host: "https://rockblocks.app",
  };
}
