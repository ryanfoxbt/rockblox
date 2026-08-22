import { Metadata } from "next";

// Every shareable page (a claimed board, its Stack, a curated song, a
// song's Stack) wants the same shape of preview: its own title/description,
// a canonical/og:url pointing at itself, and the site's branded social image
// — without this last part a page that sets its own `openGraph`/`twitter`
// silently loses the image the root layout's opengraph-image.tsx would
// otherwise supply by default, and Slack/Discord/iMessage previews end up
// looking bare next to ones that never overrode openGraph at all.
export function buildShareMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}
