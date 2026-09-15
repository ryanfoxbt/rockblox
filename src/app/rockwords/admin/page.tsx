import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { rockWordsWords } from "@/db/schema";
import { requireRockWordsAdmin } from "@/lib/auth/rockWordsAdmin";
import { getRockWordsMaxRows } from "@/lib/rockWordsSettingsServer";
import { ROCKWORDS_BEAT_RULES } from "@/lib/rockWordsBeat";
import { RockWordsAdminList } from "@/components/RockWordsAdminList";
import { RockWordsSettingsPanel } from "@/components/RockWordsSettingsPanel";

export default async function RockWordsAdminPage() {
  await requireRockWordsAdmin();

  const db = getDb();
  const [rows, maxRows] = await Promise.all([
    db
      .select({
        id: rockWordsWords.id,
        grade: rockWordsWords.grade,
        word: rockWordsWords.word,
        clue: rockWordsWords.clue,
        isPublished: rockWordsWords.isPublished,
      })
      .from(rockWordsWords)
      .orderBy(asc(rockWordsWords.grade), asc(rockWordsWords.word)),
    getRockWordsMaxRows(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/rockwords" className="transition hover:text-yellow-400">
            RockWords
          </Link>{" "}
          / <span className="text-white/60">Admin</span>
        </nav>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Word <span className="text-yellow-400">Editor</span>
          </h1>
          <Link
            href="/rockwords/admin/new"
            className="mt-1 shrink-0 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-bold text-slate-950 transition hover:bg-yellow-300"
          >
            + New word
          </Link>
        </div>
        <p className="mt-2 text-sm text-white/50">
          Edit a word&rsquo;s clue, whether that clue shows by default, or publish/unpublish it. Unpublished
          words are hidden from the live rotation on{" "}
          <Link href="/rockwords" className="text-yellow-400 transition hover:underline">
            /rockwords
          </Link>
          .
        </p>

        <RockWordsSettingsPanel initialMaxRows={maxRows} />

        <RockWordsAdminList initialWords={rows} />

        <section className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-white/40">
            Beat rules (how a round becomes a drum pattern)
          </h2>
          <p className="mt-1 text-sm text-white/60">
            The exact deterministic rules <code className="text-white/80">generateRockWordsBeat</code> uses to
            turn a played round into a RockBlocks pattern — pulled straight from{" "}
            <code className="text-white/80">src/lib/rockWordsBeat.ts</code>, so this list is always what the
            game actually does. Ask for a change to any rule here and I&rsquo;ll update the code to match.
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {ROCKWORDS_BEAT_RULES.map((rule, i) => (
              <li key={rule.title} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-sm font-semibold text-white/90">
                  {i + 1}. {rule.title}
                </span>
                <p className="mt-0.5 text-xs text-white/50">{rule.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
