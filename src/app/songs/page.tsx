import Link from "next/link";
import { Metadata } from "next";
import { FAMOUS_SONGS } from "@/lib/famousSongs";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { SITE_URL, songJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = buildShareMetadata({
  title: "Famous Song Drum Beats",
  description:
    "Famous songs' drum patterns, mapped out beat-for-beat on RockBlocks. Play them in your browser, remix them, or use them as a template for your own beat — free, no login.",
  path: "/songs",
});

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Famous Song Drum Beats",
  url: `${SITE_URL}/songs`,
  description:
    "A library of famous songs' drum patterns, mapped out on RockBlocks and playable in the browser.",
  hasPart: FAMOUS_SONGS.map((s) => songJsonLd(s)),
};

export default function SongsIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <JsonLd data={collectionJsonLd} />
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Famous Song Drum Beats
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Real songs&apos; drum patterns, mapped out beat-for-beat on Rock<span className="text-yellow-400">Blocks</span>.
          Play any of them in your browser, slow them down, or use one as the starting point for your own beat —
          nothing you change here saves, so everyone gets the same starting point.
        </p>
        <ul className="mt-6 flex flex-col gap-2">
          {FAMOUS_SONGS.map((song) => (
            <li key={song.slug}>
              <Link
                href={`/songs/${song.slug}`}
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-3 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                <span>
                  <span className="font-semibold">{song.title}</span>
                  <span className="text-white/50"> — {song.artist}</span>
                </span>
                <span className="text-white/30">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
