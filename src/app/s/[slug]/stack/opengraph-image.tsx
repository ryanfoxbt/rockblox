import { loadPublicSong } from "@/lib/publicSong";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderPublicSongOgImage } from "@/lib/publicSongOgImage";

// Same card as the parent /s/<slug> route — the /stack view shares a
// segment param shape ({ slug }), so this just re-runs the generator.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = OG_ALT;
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderPublicSongOgImage(await loadPublicSong(slug));
}
