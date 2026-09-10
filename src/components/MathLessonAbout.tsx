import Link from "next/link";

interface NeighborLesson {
  slug: string;
  lessonNumber: number;
  title: string;
  mathSkill: string;
}

// Lower-cases the first letter and strips a trailing period so a lesson's
// `teaches` line can be dropped mid-sentence — same trick as LessonAbout.tsx.
function inline(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.\s*$/, "");
}

// Server-rendered reference text for a single RockBlocks Math lesson, shown
// below the interactive editor — the math concept, where it sits in the
// grade's curriculum, and text links to its neighbours. Mirrors
// LessonAbout.tsx (Drum School), with the math concept called out alongside
// the drum correlation instead of just the drum idea alone.
export function MathLessonAbout({
  lesson,
  prev,
  next,
  total,
}: {
  lesson: { grade: number; lessonNumber: number; title: string; mathSkill: string; teaches: string };
  prev: NeighborLesson | null;
  next: NeighborLesson | null;
  total: number;
}) {
  return (
    <section
      aria-labelledby="math-lesson-about"
      className="border-t border-white/10 bg-slate-950 px-4 py-12 text-white sm:px-6"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/math" className="transition hover:text-yellow-400">
            RockBlocks Math
          </Link>{" "}
          / <span className="text-white/60">Grade {lesson.grade} Lesson {lesson.lessonNumber}</span>
        </nav>

        <h1 id="math-lesson-about" className="text-2xl font-black tracking-tight sm:text-3xl">
          Grade {lesson.grade}, Lesson {lesson.lessonNumber}: {lesson.title}
        </h1>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          <span className="font-semibold text-white/90">Math skill:</span> {lesson.mathSkill}
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          <span className="font-semibold text-white/90">How the beat teaches it:</span> {lesson.teaches}
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          This is lesson {lesson.lessonNumber} of {total} in{" "}
          <Link href="/math" className="text-yellow-400 transition hover:text-yellow-300">
            RockBlocks Math, Grade {lesson.grade}
          </Link>
          , a free course where every lesson turns a math idea into something you can count, hear, and play.{" "}
          {prev ? (
            <>
              The previous lesson,{" "}
              <Link href={`/math/${prev.slug}`} className="text-yellow-400 transition hover:text-yellow-300">
                &ldquo;{prev.title},&rdquo;
              </Link>{" "}
              covered {inline(prev.mathSkill)}.
            </>
          ) : (
            <>It is the first lesson in Grade {lesson.grade}, so it assumes no prior math or drumming.</>
          )}{" "}
          {next ? (
            <>
              Next is Lesson {next.lessonNumber},{" "}
              <Link href={`/math/${next.slug}`} className="text-yellow-400 transition hover:text-yellow-300">
                &ldquo;{next.title}.&rdquo;
              </Link>
            </>
          ) : (
            <>It is the final lesson in this grade.</>
          )}
        </p>

        <p className="text-sm leading-relaxed text-white/70 sm:text-base">
          Every slot above (A, B, C, D) is its own question, and it&rsquo;s a real, blank RockBlocks beat the
          whole time — the same drag-and-drop tiles, kit, tempo, sheet music, and drummer view as anywhere else
          on the site. Tap <span className="font-mono text-yellow-400/90">❓ Question</span> in the corner to read
          the current slot&rsquo;s problem, build your answer right in the grid, then tap{" "}
          <span className="font-mono text-yellow-400/90">✓ Check Answer</span> to grade it. Once you&rsquo;re
          done, keep going: expand the beat, drop it into a Stack, or save a copy to your own page — nothing here
          overwrites the lesson itself, so every visitor still starts from the same blank slots.
        </p>

        <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          {prev && (
            <Link href={`/math/${prev.slug}`} className="transition hover:text-yellow-400">
              ← Lesson {prev.lessonNumber}
            </Link>
          )}
          <Link href="/math" className="transition hover:text-yellow-400">
            All Grade {lesson.grade} lessons
          </Link>
          {next && (
            <Link href={`/math/${next.slug}`} className="transition hover:text-yellow-400">
              Lesson {next.lessonNumber} →
            </Link>
          )}
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
