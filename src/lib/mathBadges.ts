// RockBlocks Math's gamification badges — drum-gear themed, unlocked purely
// by counting solved questions and completed lessons. Deliberately not
// stored anywhere: both `totalSolved` and `lessonsCompleted` are recomputed
// from the solved set every time (see useMathProgress.ts), so adding,
// renaming, or re-thresholding a badge here never needs a data migration.
export interface MathBadge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isEarned: (stats: MathProgressStats) => boolean;
}

export interface MathProgressStats {
  totalSolved: number;
  lessonsCompleted: number;
  totalLessons: number;
}

export const MATH_BADGES: MathBadge[] = [
  {
    id: "drumsticks",
    name: "Drumsticks",
    emoji: "🥢",
    description: "Answer your first question correctly.",
    isEarned: (s) => s.totalSolved >= 1,
  },
  {
    id: "practice-pad",
    name: "Practice Pad",
    emoji: "🟫",
    description: "Solve 5 questions.",
    isEarned: (s) => s.totalSolved >= 5,
  },
  {
    id: "snare-drum",
    name: "Snare Drum",
    emoji: "🥁",
    description: "Finish every question in one lesson.",
    isEarned: (s) => s.lessonsCompleted >= 1,
  },
  {
    id: "hi-hat",
    name: "Hi-Hat",
    emoji: "🔔",
    description: "Solve 10 questions.",
    isEarned: (s) => s.totalSolved >= 10,
  },
  {
    id: "full-kit",
    name: "Full Kit",
    emoji: "🏆",
    description: "Finish every available lesson.",
    isEarned: (s) => s.totalLessons > 0 && s.lessonsCompleted >= s.totalLessons,
  },
];

export function earnedBadges(stats: MathProgressStats): MathBadge[] {
  return MATH_BADGES.filter((b) => b.isEarned(stats));
}
