import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { isReservedBoardName, isValidBoardName, normalizeBoardSlug, SLOT_LETTERS } from "@/lib/board";
import { Editor } from "@/components/Editor";
import { ClaimBoard } from "@/components/ClaimBoard";

// Every claimed page otherwise inherits the root layout's static title
// verbatim, which means every /name URL would show up identically in search
// results — this gives each one a distinct, real title/description instead.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  if (!isValidBoardName(name) || isReservedBoardName(name)) return {};

  const db = getDb();
  const [board] = await db
    .select({ displayName: boards.displayName })
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(name)))
    .limit(1);
  if (!board) return {};

  const title = `${board.displayName}'s Beat`;
  const description = `${board.displayName}'s drum beat, built on RockBlocks — a free, browser-based drum machine. Play it, or make your own free at rockblocks.app.`;
  return {
    title,
    description,
    alternates: { canonical: `/${board.displayName}` },
    openGraph: { title, description, url: `/${board.displayName}` },
    twitter: { title, description },
  };
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { name } = await params;
  const { slot } = await searchParams;

  if (!isValidBoardName(name) || isReservedBoardName(name)) notFound();

  const db = getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(name)))
    .limit(1);

  if (!board) {
    return <ClaimBoard name={name} />;
  }

  const initialSlot = SLOT_LETTERS.find((l) => l === slot);

  return (
    <Editor
      board={{
        slug: board.slug,
        displayName: board.displayName,
        slots: { A: board.slotA, B: board.slotB, C: board.slotC, D: board.slotD },
        textToBeatShowRules: board.textToBeatShowRules,
      }}
      initialSlot={initialSlot}
    />
  );
}
