import { MetadataRoute } from "next";
import { SHORT_TAGLINE, SITE_NAME } from "@/lib/seo";

// Web app manifest — Next serves it at /manifest.webmanifest and links it
// from every page's <head>. Keeps the app name/description consistent for
// "add to home screen" and for crawlers that read the manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Free Online Drum Machine & Beat Maker`,
    short_name: SITE_NAME,
    description: SHORT_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    categories: ["music", "entertainment", "education"],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
