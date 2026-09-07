import Link from "next/link";
import { Metadata } from "next";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { JsonLd } from "@/components/JsonLd";
import { aboutPageJsonLd, breadcrumbJsonLd, BRAND_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = buildShareMetadata({
  title: "About RockBlocks",
  description:
    "RockBlocks is a reimagined drum machine that anyone can play — a free browser app today, and a physical instrument for toy shops and music stores in the future.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <JsonLd data={aboutPageJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ])}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
          ← Back home
        </Link>

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          About Rock<span className="text-yellow-400">Blocks</span>
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">{BRAND_DESCRIPTION}</p>

        <h2 className="mt-4 text-lg font-bold">The idea</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          A classic drum machine asks you to think in a 16-step grid before you can make a sound. RockBlocks
          replaces that with <span className="text-white/90">beat blocks</span> — one block per beat, one row
          per drum piece — and a palette of rhythm tiles you drag in: a quarter note, two eighths, a triplet,
          a sixteenth run. Drop a tile into a block and it plays. That is the whole learning curve, which is
          why a five-year-old can build a real groove on their first try.
        </p>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          The same model scales up. Bars can be any length from 1 to 16 beats, so odd time signatures like
          5/4 and 7/8 are first-class, not a workaround. Tiles carry accents, ghost notes, and triplets. An
          Inspiration generator will hand you a fresh beat, a groove variation, a fill, or a human-playable
          drum solo at a complexity you choose. You can turn a sentence into a groove, transcribe the drums
          out of an MP3, arrange sections into a full song, and export MP3 or MIDI. It stays approachable
          without staying shallow.
        </p>

        <h2 className="mt-4 text-lg font-bold">What&apos;s in the web app</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Everything, for free, with no account:{" "}
          <Link href="/" className="text-yellow-400 transition hover:text-yellow-300">
            the drum machine
          </Link>{" "}
          with several classic drum-machine kits,{" "}
          <Link href="/school" className="text-yellow-400 transition hover:text-yellow-300">
            a 100-lesson Drum School
          </Link>{" "}
          that builds a groove one idea at a time, and{" "}
          <Link href="/songs" className="text-yellow-400 transition hover:text-yellow-300">
            famous songs mapped out beat-for-beat
          </Link>
          . Save a beat to a personal page at rockblocks.app/YourName or share any pattern by link. Export an
          MP3 or MIDI to{" "}
          <Link href="/ai-music" className="text-yellow-400 transition hover:text-yellow-300">
            use as a drum track for Suno and other AI music tools
          </Link>
          .
        </p>

        <h2 className="mt-4 text-lg font-bold">The physical RockBlocks</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          RockBlocks is designed to become a physical instrument — a hands-on drum machine you can hold, aimed
          at toy shops and music stores, where placing a block is placing a beat. The web app is the first
          form of that idea: it is free, it works today, and it is where the concept is being proven. If you
          run a shop or teach music and want to hear when the physical version is ready, that interest is
          worth registering early.
        </p>

        <h2 className="mt-4 text-lg font-bold">Free access</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          The web app requires no payment and no login for any feature. A claimed page at rockblocks.app/YourName
          is public and unauthenticated by design — anyone with the link can view and remix it.
        </p>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
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
        </nav>
      </div>
    </div>
  );
}
