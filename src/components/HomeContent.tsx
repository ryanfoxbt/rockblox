import Link from "next/link";
import { ENTITY_DESCRIPTION, FAQ, FEATURE_LIST, HOW_TO_STEPS } from "@/lib/seo";

// Server-rendered reference content that sits below the interactive editor
// on the homepage. The app stays the hero and is usable immediately; this
// block is what a search crawler or an LLM answer engine actually reads —
// one clear entity definition, enumerated how-to steps, a feature list, who
// it's for, the physical-product note, and an FAQ that mirrors the FAQPage
// JSON-LD in lib/seo.ts.
export function HomeContent() {
  return (
    <section
      aria-labelledby="about-rockblocks"
      className="border-t border-white/10 bg-slate-950 px-4 py-14 text-white sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-4">
          <h1 id="about-rockblocks" className="text-2xl font-black tracking-tight sm:text-3xl">
            RockBlocks: a free online drum machine anyone can play
          </h1>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base">{ENTITY_DESCRIPTION}</p>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base">
            It is a reimagined drum machine: simple enough that a young child can drop tiles into the grid and
            hear a real beat on the first try, and deep enough that a working musician can sketch a groove in
            5/4 or 7/8, generate a unique fill or drum solo, and export it as MIDI. No account, no download —
            open the page and start.
          </p>
          <p className="text-sm text-white/50">
            The drum machine is right above — start dropping tiles into the grid. More to explore:{" "}
            <Link href="/school" className="text-yellow-400 transition hover:text-yellow-300">
              Drum School (100 free lessons)
            </Link>
            ,{" "}
            <Link href="/songs" className="text-yellow-400 transition hover:text-yellow-300">
              famous song drum beats
            </Link>
            ,{" "}
            <Link href="/ai-music" className="text-yellow-400 transition hover:text-yellow-300">
              drum beats for Suno &amp; AI music
            </Link>
            , and{" "}
            <Link href="/about" className="text-yellow-400 transition hover:text-yellow-300">
              about RockBlocks
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">How to make a drum beat</h2>
          <ol className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
            {HOW_TO_STEPS.map((step, i) => (
              <li key={step.name} className="flex gap-3">
                <span className="font-mono text-yellow-400">{i + 1}.</span>
                <span>
                  <span className="font-semibold text-white/90">{step.name}.</span> {step.text}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">What you can do with RockBlocks</h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
            {FEATURE_LIST.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Who it&apos;s for</h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
            <li>
              <span className="font-semibold text-white/90">Kids and first-time beatmakers</span> — tiles snap
              into the grid, so a real beat happens on the very first try.
            </li>
            <li>
              <span className="font-semibold text-white/90">Drummers and producers</span> — sketch grooves
              fast in any meter, generate variations, fills, and playable solos, then export MIDI into a DAW.
            </li>
            <li>
              <span className="font-semibold text-white/90">Songwriters</span> — turn a lyric into a starting
              groove with TextyBeat, or drop in a famous song&apos;s drum part as a template.
            </li>
            <li>
              <span className="font-semibold text-white/90">Music teachers</span> — a free, no-login step
              sequencer for showing how a groove is built one piece at a time, with a 100-lesson Drum School.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
          <h2 className="text-xl font-bold">RockBlocks is becoming a physical instrument</h2>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base">
            The web app is the first form of RockBlocks. A physical RockBlocks — a hands-on drum machine you
            can hold, built for toy shops and music stores — is in the works. Same idea: a drum machine anyone
            can play.{" "}
            <Link href="/about" className="text-yellow-400 underline decoration-dotted transition hover:text-yellow-300">
              Read more on the About page
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Frequently asked questions</h2>
          <dl className="flex flex-col gap-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-white/90 sm:text-base">{q}</dt>
                <dd className="text-sm leading-relaxed text-white/70 sm:text-base">{a}</dd>
              </div>
            ))}
          </dl>
        </div>

        <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/songs" className="transition hover:text-yellow-400">
            Songs
          </Link>
          <Link href="/ai-music" className="transition hover:text-yellow-400">
            AI music
          </Link>
          <Link href="/about" className="transition hover:text-yellow-400">
            About
          </Link>
        </nav>
      </div>
    </section>
  );
}
