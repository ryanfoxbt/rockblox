import Link from "next/link";
import { Metadata } from "next";
import { FAMOUS_SONGS } from "@/lib/famousSongs";
import { buildShareMetadata } from "@/lib/shareMetadata";

export const metadata: Metadata = buildShareMetadata({
  title: "Songs",
  description:
    "Famous songs' drumming, mapped out on RockBlocks. Play them, remix them, or use them as inspiration for your own beat — free at rockblocks.app.",
  path: "/songs",
});

export default function SongsIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Rock<span className="text-yellow-400">Blocks</span> Songs
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Real songs, mapped out beat-for-beat. Play with any of them — nothing you change here saves, so everyone
          gets the same starting point.
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
