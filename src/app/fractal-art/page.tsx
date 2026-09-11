import Link from "next/link";
import { Metadata } from "next";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { JsonLd } from "@/components/JsonLd";
import {
  FRACTAL_ART_DESCRIPTION,
  FRACTAL_ART_FAQ,
  FRACTAL_ART_STEPS,
  fractalArtPageJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  ...buildShareMetadata({
    title: "Fractal Art — Turn a Beat into a TikTok/Reels Video",
    description:
      "Turn any RockBlocks beat into generative line art and export a share-ready video — vertical for TikTok and Instagram Reels, or square — free, with no account.",
    path: "/fractal-art",
  }),
  keywords: [
    "drum beat visualizer",
    "music visualizer video maker",
    "turn a beat into a video",
    "make a tiktok video from a beat",
    "beat video for instagram reels",
    "generative art from music",
    "free music visualizer",
    "drum pattern video export",
    "audio visualizer online",
    "beat to video converter",
  ],
};

export default function FractalArtPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <JsonLd data={fractalArtPageJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Fractal Art", url: "/fractal-art" },
        ])}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          / <span className="text-white/60">Fractal Art</span>
        </nav>

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Turn a beat into a TikTok or Reels video
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">{FRACTAL_ART_DESCRIPTION}</p>

        <h2 className="mt-4 text-lg font-bold">What Fractal Art actually draws</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Every drum piece in your beat — bass drum, snare, hi-hat, and the rest — gets its own continuous
          line, colored to match, whose shape comes from that piece&apos;s own rhythm. Layered together and
          looped with the music, a simple beat reads as a clean, spare sketch and a busy one blooms into
          something dense and intricate — the picture is a direct reflection of the pattern you actually
          built in{" "}
          <Link href="/" className="text-yellow-400 transition hover:text-yellow-300">
            RockBlocks
          </Link>
          , not a generic waveform or a stock animation.
        </p>

        <h2 className="mt-4 text-lg font-bold">How to make the video</h2>
        <ol className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
          {FRACTAL_ART_STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-3">
              <span className="font-mono text-yellow-400">{i + 1}.</span>
              <span>
                <span className="font-semibold text-white/90">{step.name}.</span> {step.text}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-4 text-lg font-bold">Built for TikTok and Instagram Reels</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          The export is a real MP4 file — H.264 video, AAC audio — sized 9:16 vertical for TikTok and
          Instagram Reels, or 1:1 square, so it drops straight into an upload without cropping or
          re-encoding on your end. Your beat&apos;s own sheet music rides along the bottom with a live
          playhead, and a small RockBlocks logo sits in the corner by default — turn it off in the Share
          Video panel if you&apos;d rather post it clean.
        </p>

        <h2 className="mt-4 text-lg font-bold">Five looks, one beat</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Pick a dark (glow) or light (ink) background, then a style: <span className="text-white/90">Classic</span>{" "}
          for the plain line art, <span className="text-white/90">Bloom</span> for a soft halo behind it,{" "}
          <span className="text-white/90">Vignette</span> for a darkened, poster-like edge,{" "}
          <span className="text-white/90">Vivid</span> for bigger, glowing, saturated color, or{" "}
          <span className="text-white/90">Prism</span> for a rainbow-fringed, chromatic-shift look. Same
          beat, five different videos — worth trying a couple before you record.
        </p>

        <h2 className="mt-4 text-lg font-bold">Everything here is free</h2>
        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Fractal Art, every style, and the video export all work with no account and no payment. Export as
          many clips as you want, in either aspect ratio, at any clip length from 7 to 15 seconds.
        </p>

        <div className="mt-2 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Frequently asked questions</h2>
          <dl className="flex flex-col gap-4">
            {FRACTAL_ART_FAQ.map(({ q, a }) => (
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
          <Link href="/ai-music" className="transition hover:text-yellow-400">
            AI music
          </Link>
          <Link href="/about" className="transition hover:text-yellow-400">
            About
          </Link>
        </nav>
      </div>
    </div>
  );
}
