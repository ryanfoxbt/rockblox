import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { patterns } from "@/db/schema";
import { Editor } from "@/components/Editor";

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
