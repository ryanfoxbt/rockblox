import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getDb } from "@/db";
import { rockWordsWords } from "@/db/schema";
import { beatsPerRow, gradeBySlug } from "@/lib/rockWords";
import { getRockWordsMaxRows } from "@/lib/rockWordsSettingsServer";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { breadcrumbJsonLd, rockWordsCourseJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { RockWordsGame } from "@/components/RockWordsGame";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gradeSlug: string }>;
}): Promise<Metadata> {
  const { gradeSlug } = await params;
  const grade = gradeBySlug(gradeSlug);
  return buildShareMetadata({
    title: grade ? `RockWords — ${grade.label} Word Game` : "RockWords",
    description: `Guess the word, build a real RockBlocks drum beat as you go — ${grade?.label ?? ""} edition.`,
    path: `/rockwords/${gradeSlug}`,
  });
}

export default async function RockWordsGradePage({ params }: { params: Promise<{ gradeSlug: string }> }) {
  const { gradeSlug } = await params;
  const grade = gradeBySlug(gradeSlug);
  if (!grade) notFound();

  const crumb = (
    <nav aria-label="Breadcrumb" className="text-xs text-white/40">
      <Link href="/" className="transition hover:text-yellow-400">
        Home
      </Link>{" "}
      /{" "}
      <Link href="/rockwords" className="transition hover:text-yellow-400">
        RockWords
      </Link>{" "}
      / <span className="text-white/60">{grade.label}</span>
    </nav>
  );

  if (!grade.isLive) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          {crumb}
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {grade.label} <span className="text-yellow-400">RockWords</span>
          </h1>
          <p className="mt-4 text-sm text-white/60">
            Coming soon! Kindergarten is playable right now —{" "}
            <Link href="/rockwords/kindergarten" className="text-yellow-400 underline decoration-dotted hover:text-yellow-300">
              give it a try
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const db = getDb();
  // Picked with SQL's own random() rather than Math.random() over a fetched
  // array — keeps this Server Component's render pure (no impure calls in
  // the render body) and only ever pulls the one row that's actually needed.
  const [rows, maxRows, [{ wordCount }]] = await Promise.all([
    db
      .select({
        id: rockWordsWords.id,
        word: rockWordsWords.word,
        clue: rockWordsWords.clue,
        clueShownByDefault: rockWordsWords.clueShownByDefault,
      })
      .from(rockWordsWords)
      .where(and(eq(rockWordsWords.grade, grade.grade), eq(rockWordsWords.isPublished, true)))
      .orderBy(sql`random()`)
      .limit(1),
    getRockWordsMaxRows(),
    db
      .select({ wordCount: count() })
      .from(rockWordsWords)
      .where(and(eq(rockWordsWords.grade, grade.grade), eq(rockWordsWords.isPublished, true))),
  ]);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          {crumb}
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {grade.label} <span className="text-yellow-400">RockWords</span>
          </h1>
          <p className="mt-4 text-sm text-white/60">No words are published for {grade.label} yet — check back soon.</p>
        </div>
      </div>
    );
  }

  const initialRound = rows[0];
  const needsTwoBeats = beatsPerRow(grade.wordLength) > 1;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <JsonLd data={rockWordsCourseJsonLd(grade.grade, wordCount)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "RockWords", url: "/rockwords" },
          { name: grade.label, url: `/rockwords/${grade.slug}` },
        ])}
      />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {crumb}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          {grade.label} <span className="text-yellow-400">RockWords</span>
        </h1>
        <p className="text-sm text-white/50">
          Guess the {grade.wordLength}-letter word. Every guess adds a new row to your beat — right letters hit
          hard, close-but-wrong letters land off the beat, wrong letters still get their own real drum hit
          instead of going silent, and vowels always add their own drum color.
        </p>
        {needsTwoBeats && (
          <p className="text-xs text-white/40">
            {grade.label} words are long enough to need two beats each, so this grade always gets 4 guesses no
            matter what the site-wide setting is — a full pattern only has 8 beats to work with.
          </p>
        )}
        <div className="mt-2">
          <RockWordsGame grade={grade} initialRound={initialRound} maxRows={maxRows} />
        </div>
      </div>
    </div>
  );
}
