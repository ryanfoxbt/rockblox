import Link from "next/link";
import { Metadata } from "next";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { JsonLd } from "@/components/JsonLd";
import {
  AI_MUSIC_DESCRIPTION,
  AI_MUSIC_FAQ,
  AI_MUSIC_STEPS,
  aiMusicPageJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  ...buildShareMetadata({
    title: "Drum Beats for Suno & AI Music",
    description:
      "Make a drum beat in RockBlocks and use it to power your AI music: export an MP3 to seed a Suno, Udio, or Riffusion track, or MIDI to build the drums in a DAW.",
    path: "/ai-music",
  }),
  keywords: [
    "drum beats for suno",
    "suno drum track",
    "how to make suno songs better",
    "improve ai generated music rhythm",
    "ai music drum input",
    "udio drum beats",
    "riffusion drum loop",
    "midi drums for ai music",
    "drum loops for ai music",
    "audio input for suno",
    "make ai music more complex",
  ],
};

export default function AiMusicPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <JsonLd data={aiMusicPageJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "AI music", url: "/ai-music" },
        ])}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          / <span className="text-white/60">AI music</span>
        </nav>

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Drum beats for Suno &amp; AI music
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">{AI_MUSIC_DESCRIPTION}</p>

        <h2 className="mt-4 text-lg font-bold">Why start an AI song from a drum beat</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          A text prompt describes a vibe. It does not say where the kick and snare land, what the fill does
          going into the chorus, or that the song is in 5/4. AI music generators left to invent their own
          drums tend to land on the same safe, quantized backbeat. If you hand the model a real drum pattern
          instead, the rhythm section is locked in and the AI fills in melody, harmony, and arrangement over a
          foundation you chose.
        </p>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          RockBlocks is built for making that pattern deliberately: odd time signatures, triplet feels, ghost
          notes and accents, and an{" "}
          <Link href="/" className="text-yellow-400 transition hover:text-yellow-300">
            Inspiration generator
          </Link>{" "}
          with a complexity dial for fills and human-playable solos. You can also generate a bass line that
          follows the kick and snare — key, scale, octave, and how busy it walks are all yours to set — and
          fold it into the export, so the AI gets a harmonic root, not just a rhythm. Then it exports an MP3
          or a MIDI file — the two formats AI music tools actually take.
        </p>

        <h2 className="mt-4 text-lg font-bold">How to use a RockBlocks beat in an AI music tool</h2>
        <ol className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
          {AI_MUSIC_STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-3">
              <span className="font-mono text-yellow-400">{i + 1}.</span>
              <span>
                <span className="font-semibold text-white/90">{step.name}.</span> {step.text}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-4 text-lg font-bold">MP3 or MIDI?</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Use the <span className="text-white/90">MP3 export</span> when the tool takes an audio seed directly
          — Suno, Udio, and Riffusion all build a track around an uploaded clip. Use the{" "}
          <span className="text-white/90">MIDI export</span> when you want to trigger your own drum samples in
          a DAW, render stems, or line the drums up with other MIDI parts before the AI tool is involved. Many
          workflows use both: MIDI to produce a clean drum stem, then that stem as the audio seed.
        </p>

        <h2 className="mt-4 text-lg font-bold">Everything here is free</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Building beats, the Inspiration generator, generated bass lines, TextyBeat, and MP3 and MIDI export
          all work with no account and no payment. RockBlocks is not affiliated with Suno, Udio, or
          Riffusion; it just makes drum parts those tools can read.
        </p>

        <div className="mt-2 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Frequently asked questions</h2>
          <dl className="flex flex-col gap-4">
            {AI_MUSIC_FAQ.map(({ q, a }) => (
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
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/songs" className="transition hover:text-yellow-400">
            Song beats
          </Link>
          <Link href="/fractal-art" className="transition hover:text-yellow-400">
            Fractal Art video
          </Link>
          <Link href="/about" className="transition hover:text-yellow-400">
            About
          </Link>
        </nav>
      </div>
    </div>
  );
}
