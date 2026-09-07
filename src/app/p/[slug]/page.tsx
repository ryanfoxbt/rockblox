import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { patterns } from "@/db/schema";
import { Editor } from "@/components/Editor";

// A shared-pattern link is an ephemeral, near-duplicate view of the editor
// with someone's one-off beat in it — not its own destination. Keep it out
// of the index; the link still works and still previews fine when shared.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function SharedPattern({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();

  const [pattern] = await db.select().from(patterns).where(eq(patterns.slug, slug)).limit(1);

  if (!pattern) notFound();

  return (
    <Editor
      initialBpm={pattern.bpm}
      initialLines={pattern.lines}
      initialKit={pattern.kit ?? undefined}
      initialCustomSamples={pattern.customSamples ?? undefined}
      initialSlug={slug}
    />
  );
}
