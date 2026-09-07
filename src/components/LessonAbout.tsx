import Link from "next/link";
import type { DrumLesson } from "@/lib/drumSchool";

// Lower-cases the first letter and strips a trailing period so a lesson's
// `teaches` line ("Snare on beats 2 and 4.") can be dropped mid-sentence.
function inline(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.\s*$/, "");
}

// Server-rendered reference text for a single Drum School lesson, shown
// below the interactive editor. The editor stays the main event; this gives
// the page real, unique, crawlable content — the lesson's topic, where it
// sits in the 100-lesson curriculum, and text links to its neighbours.
export function LessonAbout({
  lesson,
  prev,
  next,
  total,
}: {
  lesson: { lessonNumber: number; title: string; teaches: string };
  prev: DrumLesson | null;
  next: DrumLesson | null;
  total: number;
}) {
  return (
    <section
      aria-labelledby="lesson-about"
      className="border-t border-white/10 bg-slate-950 px-4 py-12 text-white sm:px-6"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>{" "}
          / <span className="text-white/60">Lesson {lesson.lessonNumber}</span>
        </nav>

        <h1 id="lesson-about" className="text-2xl font-black tracking-tight sm:text-3xl">
          Lesson {lesson.lessonNumber}: {lesson.title}
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          <span className="font-semibold text-white/90">What this lesson teaches:</span> {lesson.teaches}
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          This is lesson {lesson.lessonNumber} of {total} in{" "}
          <Link href="/school" className="text-yellow-400 transition hover:text-yellow-300">
            RockBlocks Drum School
          </Link>
          , a free, stepwise course where each lesson adds one new idea to the one before it.{" "}
          {prev ? (
            <>
              The previous lesson,{" "}
              <Link
                href={`/school/${prev.slug}`}
                className="text-yellow-400 transition hover:text-yellow-300"
              >
                &ldquo;{prev.title},&rdquo;
              </Link>{" "}
              covered {inline(prev.teaches)}.
            </>
          ) : (
            <>It is the first lesson, so it assumes no prior drumming.</>
          )}{" "}
          {next ? (
            <>
              Next is Lesson {next.lessonNumber},{" "}
              <Link
                href={`/school/${next.slug}`}
                className="text-yellow-400 transition hover:text-yellow-300"
              >
                &ldquo;{next.title}.&rdquo;
              </Link>
            </>
          ) : (
            <>It is the final lesson in the curriculum.</>
          )}
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          The lesson beat is loaded in the grid above. Press play to hear the loop, or drag the beat blocks to
          see how the groove is put together, one drum row at a time. Nothing you change here is saved, so
          every visitor starts from the same pattern.
        </p>

        <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          {prev && (
            <Link href={`/school/${prev.slug}`} className="transition hover:text-yellow-400">
              ← Lesson {prev.lessonNumber}
            </Link>
          )}
          <Link href="/school" className="transition hover:text-yellow-400">
            All lessons
          </Link>
          {next && (
            <Link href={`/school/${next.slug}`} className="transition hover:text-yellow-400">
              Lesson {next.lessonNumber} →
            </Link>
          )}
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
        </nav>
      </div>
    </section>
  );
}
