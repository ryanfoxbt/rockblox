import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { rockWordsWords } from "@/db/schema";
import { requireRockWordsAdmin } from "@/lib/auth/rockWordsAdmin";
import { RockWordsWordForm } from "@/components/RockWordsWordForm";

export default async function EditRockWordsWordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRockWordsAdmin();
  const { id } = await params;

  const db = getDb();
  const [word] = await db
    .select()
    .from(rockWordsWords)
    .where(eq(rockWordsWords.id, Number(id)))
    .limit(1);
  if (!word) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/rockwords/admin" className="transition hover:text-yellow-400">
            RockWords Admin
          </Link>{" "}
          / <span className="text-white/60 uppercase">{word.word}</span>
        </nav>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Edit <span className="text-yellow-400">{word.word}</span>
        </h1>
        <RockWordsWordForm initial={word} />
      </div>
    </div>
  );
}
