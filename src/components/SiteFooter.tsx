import Link from "next/link";

// A small site footer for pages that are otherwise all app chrome and have
// no outbound links (claimed boards, the claim screen). Gives every page a
// crawlable path to the pillar content and one plain-language line about
// what the site is.
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-4 py-8 text-sm text-white/50 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <p>
          <Link href="/" className="font-semibold text-white/80 transition hover:text-yellow-400">
            RockBlocks
          </Link>{" "}
          is a free online drum machine and beat maker — build a beat by dragging rhythm tiles into a grid,
          in any time signature, right in your browser.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/songs" className="transition hover:text-yellow-400">
            Song beats
          </Link>
          <Link href="/ai-music" className="transition hover:text-yellow-400">
            AI music
          </Link>
          <Link href="/about" className="transition hover:text-yellow-400">
            About
          </Link>
        </nav>
      </div>
    </footer>
  );
}
