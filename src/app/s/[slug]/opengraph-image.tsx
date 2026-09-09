import { loadPublicSong } from "@/lib/publicSong";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderPublicSongOgImage } from "@/lib/publicSongOgImage";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = OG_ALT;
// Rebuilt per request so the card reflects the song's current title / length.
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderPublicSongOgImage(await loadPublicSong(slug));
}
