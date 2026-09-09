import Link from "next/link";

// Server-rendered blurb under the read-only editor on a shared song
// (/s/<slug>). Gives the page real text for a link unfurl / crawler, tells a
// first-time visitor what they're looking at, and points them at building
// their own. Mirrors SongAbout, minus the "famous song" framing.
export function PublicSongAbout({ title, summary }: { title: string; summary: string }) {
  return (
    <section
      aria-labelledby="shared-song-about"
      className="border-t border-white/10 bg-slate-950 px-4 py-12 text-white sm:px-6"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 id="shared-song-about" className="text-2xl font-black tracking-tight sm:text-3xl">
          {title}
          <span className="block text-sm font-medium text-white/40">
            a drum song made on RockBlocks{summary ? ` · ${summary}` : ""}
          </span>
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          This is a drum beat someone built on RockBlocks and shared. It&apos;s loaded in the grid above —
          press play to hear it, change the tempo, or drag the beat blocks around to see how the groove and
          its fills fit together. Nothing you change here is saved, and it never touches the original.
        </p>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Like it? Hit <span className="text-white/90">Save a copy</span> to keep your own version on a free
          page, or{" "}
          <Link href="/" className="text-yellow-400 transition hover:text-yellow-300">
            open the RockBlocks drum machine
          </Link>{" "}
          and build one from scratch. It&apos;s free and needs no login — drag rhythm tiles into a grid of
          beat blocks, in any time signature, and generate a bass line that follows along.
        </p>

        <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
          <Link href="/songs" className="transition hover:text-yellow-400">
            Famous song beats
          </Link>
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/ai-music" className="transition hover:text-yellow-400">
            AI music
          </Link>
        </nav>
      </div>
    </section>
  );
}
