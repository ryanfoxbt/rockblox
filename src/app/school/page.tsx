import Link from "next/link";
import { Metadata } from "next";
import { DRUM_LESSONS } from "@/lib/drumSchool";
import { buildShareMetadata } from "@/lib/shareMetadata";

export const metadata: Metadata = buildShareMetadata({
  title: "Drum School",
  description:
    "A stepwise beginner drum curriculum on RockBlocks — start with the pulse, add the backbeat and kick, then build up to fills and full arrangements. Free at rockblocks.app.",
  path: "/school",
});

export default function DrumSchoolIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Rock<span className="text-yellow-400">Blocks</span> Drum School
        </h1>
        <p className="mt-2 text-sm text-white/50">
          {DRUM_LESSONS.length} lessons, stepwise — each one adds a single new idea to the last. Start at Lesson 1
          even if you can already play a beat; the point is to see how a full groove gets built one piece at a
          time. Nothing you change here saves, so everyone gets the same starting point.
        </p>
        <ul className="mt-6 flex flex-col gap-2">
          {DRUM_LESSONS.map((lesson) => (
            <li key={lesson.slug}>
              <Link
                href={`/school/${lesson.slug}`}
                className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/5 px-4 py-3 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                <span>
                  <span className="text-white/30">{lesson.lessonNumber}.</span>{" "}
                  <span className="font-semibold">{lesson.title}</span>
                  <span className="block text-xs text-white/50">{lesson.teaches}</span>
                </span>
                <span className="shrink-0 text-white/30">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
