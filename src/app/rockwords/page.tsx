import Link from "next/link";
import { Metadata } from "next";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { RW_GRADES } from "@/lib/rockWords";

export const metadata: Metadata = buildShareMetadata({
  title: "RockWords — A Word Game That Builds a Drum Beat, Free",
  description:
    "RockWords is a free, grade-tailored Wordle-style word game for kids. Guess the word and watch your guesses turn into a real RockBlocks drum beat — right letters hit hard, close guesses land off the beat, and vowels add their own drum color. Kindergarten through Grade 2.",
  path: "/rockwords",
});

export default function RockWordsLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
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
          A word-guessing game for kids, grade by grade — Kindergarten&rsquo;s 3-letter words, Grade 1&rsquo;s
          4-letter words, or Grade 2&rsquo;s 5-letter words. Every guess adds a new row to a real RockBlocks drum
          beat: a right letter in the right spot hits hard, a right letter in the wrong spot lands just off the
          beat, a wrong letter still gets its own real drum hit instead of going silent, and any vowel you guess
          always adds its own drum color, correct or not. By the time you solve it (or run out of guesses),
          you&rsquo;ve built a real, playable pattern out of nothing but how you played — guesses build up in
          square &ldquo;Block&rdquo; sections side by side as you go, on brand with the rest of the app.
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          A clue is always one tap away if you get stuck. Finish a round and keep the beat going: signed in, it
          saves straight to your account as a new song; no account yet, and it just carries over to the main
          RockBlocks editor so you can keep building on it — no login required either way.
        </p>

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
                {g.isLive ? `${g.wordLength}-letter words →` : "Coming soon"}
              </span>
            </Link>
          ))}
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
