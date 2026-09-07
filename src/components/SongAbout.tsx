import Link from "next/link";

// Server-rendered reference text for a curated famous-song drum pattern,
// shown below the interactive editor. Gives the page unique crawlable
// content and text links back into the library.
export function SongAbout({ title, artist }: { title: string; artist: string }) {
  return (
    <section
      aria-labelledby="song-about"
      className="border-t border-white/10 bg-slate-950 px-4 py-12 text-white sm:px-6"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/songs" className="transition hover:text-yellow-400">
            Songs
          </Link>{" "}
          / <span className="text-white/60">{title}</span>
        </nav>

        <h1 id="song-about" className="text-2xl font-black tracking-tight sm:text-3xl">
          {title} drum beat — {artist}
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          The drum pattern from &ldquo;{title}&rdquo; by {artist}, mapped out beat-for-beat on RockBlocks and
          loaded in the grid above. Press play to hear it, change the tempo to slow it down, or drag the beat
          blocks to see exactly how the groove and its fills are put together.
        </p>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          It is free and needs no login. Nothing you change here is saved, so use it as a reference or as the
          starting point for a beat of your own — then{" "}
          <Link href="/" className="text-yellow-400 transition hover:text-yellow-300">
            open the RockBlocks drum machine
          </Link>{" "}
          to build from scratch.
        </p>

        <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          <Link href="/songs" className="transition hover:text-yellow-400">
            All song beats
          </Link>
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
        </nav>
      </div>
    </section>
  );
}
