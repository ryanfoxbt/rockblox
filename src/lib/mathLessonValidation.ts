// Validators for a RockBlocks Math lesson's editable question/answer content
// — shared by the admin edit route (PATCH /api/math-admin/lessons/[slug])
// and the admin create route (POST /api/math-admin/lessons), so a
// newly-created lesson and an edit to an existing one are held to exactly
// the same shape.
import { SLOT_LETTERS, type SlotLetter } from "@/lib/board";
import type { BeatChallengeTarget, MathChallenge } from "@/lib/mathSchool";
import { INSTRUMENTS } from "@/lib/instruments";

export function isValidTarget(t: unknown): t is BeatChallengeTarget {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;
  if (typeof o.instrument !== "string" || !INSTRUMENTS.some((i) => i.id === o.instrument)) return false;
  if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 1) return false;
  if (o.comparison !== undefined && o.comparison !== "eq" && o.comparison !== "gt" && o.comparison !== "lt") return false;
  return true;
}

export function isValidChallenge(c: unknown): c is MathChallenge {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  if (typeof o.prompt !== "string" || !o.prompt.trim()) return false;
  if (typeof o.explanation !== "string" || !o.explanation.trim()) return false;
  if (!Array.isArray(o.targets) || o.targets.length === 0 || !o.targets.every(isValidTarget)) return false;
  return true;
}

export function isValidChallenges(c: unknown): c is Record<SlotLetter, MathChallenge> {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return SLOT_LETTERS.every((letter) => isValidChallenge(o[letter]));
}

// Slugifies free text into the lowercase, hyphenated form every route/URL in
// this app expects — used to build a new lesson's slug from its grade,
// lesson number, and title (e.g. grade 2, lesson 5, "Repeated Addition &
// Arrays" -> "math-g2-l05-repeated-addition-and-arrays") so the admin never
// types a slug by hand and can't typo the app's own naming convention.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function mathLessonSlug(grade: number, lessonNumber: number, title: string): string {
  const lessonPart = String(lessonNumber).padStart(2, "0");
  const titlePart = slugify(title);
  return `math-g${grade}-l${lessonPart}${titlePart ? `-${titlePart}` : ""}`;
}
