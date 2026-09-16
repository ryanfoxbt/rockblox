import Link from "next/link";
import { Metadata } from "next";
import { buildShareMetadata } from "@/lib/shareMetadata";
import {
  breadcrumbJsonLd,
  ROCKWORDS_FAQ,
  ROCKWORDS_STEPS,
  rockWordsGradeListJsonLd,
  rockWordsPageJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { beatsPerRow, RW_GRADES } from "@/lib/rockWords";

export const metadata: Metadata = {
  ...buildShareMetadata({
    title: "RockWords — A Word Game That Builds a Drum Beat, Free",
    description:
      "RockWords is a free, grade-tailored Wordle-style word game covering Kindergarten through Grade 12. Guess the word and watch your guesses turn into a real, playable RockBlocks drum beat — right letters hit hard, wrong letters still get a real drum hit, and vowels add their own drum color.",
    path: "/rockwords",
  }),
  keywords: [
    "wordle for kids",
    "word game that makes music",
    "drum beat word game",
    "free word game by grade",
    "vocabulary game k-12",
    "elementary word game",
    "high school vocabulary game",
    "word guessing game music",
  ],
};

export default function RockWordsLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <JsonLd data={rockWordsPageJsonLd} />
      <JsonLd data={rockWordsGradeListJsonLd(RW_GRADES.filter((g) => g.isLive))} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "RockWords", url: "/rockwords" },
        ])}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          / <span className="text-white/60">RockWords</span>
        </nav>

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Rock<span className="text-yellow-400">Words</span>
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          A word-guessing game covering the full Kindergarten-through-Grade-12 range, one grade at a time —
          word length and vocabulary difficulty climb gradually as the grade goes up, from Kindergarten&rsquo;s
          3-letter everyday nouns to Grade 12&rsquo;s 11-letter capstone vocabulary. Every guess adds a new row
          to a real RockBlocks drum beat: a right letter in the right spot hits hard, a right letter in the
          wrong spot lands just off the beat, a wrong letter still gets its own real drum hit instead of going
          silent, and any vowel you guess always adds its own drum color, correct or not. By the time you solve
          it (or run out of guesses), you&rsquo;ve built a real, playable pattern out of nothing but how you
          played — guesses build up in square &ldquo;Block&rdquo; sections side by side as you go, on brand
          with the rest of the app.
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          A clue is always one tap away if you get stuck, and every guess is checked against a real dictionary
          before it counts. Finish a round and keep the beat going: signed in, it saves straight to your
          account as a new song; no account yet, and it just carries over to the main RockBlocks editor so you
          can keep building on it — no login required either way.
        </p>

        <h2 className="mt-4 text-lg font-bold">How to play</h2>
        <ol className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
          {ROCKWORDS_STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-3">
              <span className="font-mono text-yellow-400">{i + 1}.</span>
              <span>
                <span className="font-semibold text-white/90">{step.name}.</span> {step.text}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-4 text-lg font-bold">Pick a grade</h2>
        <div className="flex flex-col gap-2">
          {RW_GRADES.map((g) => (
            <Link
              key={g.slug}
              href={g.isLive ? `/rockwords/${g.slug}` : "#"}
              aria-disabled={!g.isLive}
              className={`flex items-center justify-between rounded-md border px-4 py-3 transition ${
                g.isLive
                  ? "border-white/10 bg-white/5 hover:border-yellow-400 hover:text-yellow-400"
                  : "cursor-default border-white/5 bg-white/[0.02] text-white/30"
              }`}
            >
              <span className="font-semibold">{g.label}</span>
              <span className="text-xs text-white/40">
                {g.isLive
                  ? `${g.wordLength}-letter words${beatsPerRow(g.wordLength) > 1 ? " · 4 guesses" : ""} →`
                  : "Coming soon"}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-2 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Frequently asked questions</h2>
          <dl className="flex flex-col gap-4">
            {ROCKWORDS_FAQ.map(({ q, a }) => (
              <div key={q} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-white/90 sm:text-base">{q}</dt>
                <dd className="text-sm leading-relaxed text-white/70 sm:text-base">{a}</dd>
              </div>
            ))}
          </dl>
        </div>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
          <Link href="/math" className="transition hover:text-yellow-400">
            RockBlocks Math
          </Link>
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/fractal-art" className="transition hover:text-yellow-400">
            Fractal Art
          </Link>
          <Link href="/about" className="transition hover:text-yellow-400">
            About
          </Link>
        </nav>
      </div>
    </div>
  );
}
