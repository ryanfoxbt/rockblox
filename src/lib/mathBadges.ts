// RockBlocks Math's gamification badges — a band's whole touring career,
// from a coffee-shop open mic to headlining a huge festival, unlocked purely
// by counting solved questions and completed lessons (both site-wide, not
// per grade — see MathProgressOverview for the per-grade numbers these
// don't drive). Deliberately not stored anywhere: both `totalSolved` and
// `lessonsCompleted` are recomputed from the solved set every time (see
// useMathProgress.ts), so adding, renaming, or re-thresholding a badge here
// never needs a data migration.
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
    id: "coffee-shop-open-mic",
    name: "Coffee Shop Open Mic",
    emoji: "☕",
    description: "Answer your first question correctly. Three customers clapped. One of them was your mom.",
    isEarned: (s) => s.totalSolved >= 1,
  },
  {
    id: "battle-of-the-bands",
    name: "Battle of the Bands",
    emoji: "🥁",
    description: "Finish every question in one lesson. You didn't win, but you didn't get booed off either.",
    isEarned: (s) => s.lessonsCompleted >= 1,
  },
  {
    id: "garage-band",
    name: "Garage Band Practice",
    emoji: "🚪",
    description: "Solve 10 questions. The neighbors filed a noise complaint. That's basically a Grammy.",
    isEarned: (s) => s.totalSolved >= 10,
  },
  {
    id: "dive-bar-residency",
    name: "The Dive Bar Residency",
    emoji: "🍺",
    description: "Finish 5 lessons. You play every Tuesday now, paid in nachos and \"exposure.\"",
    isEarned: (s) => s.lessonsCompleted >= 5,
  },
  {
    id: "house-party",
    name: "House Party Gig",
    emoji: "🏠",
    description: "Solve 25 questions. Someone's older sibling let you set up in the basement. Living the dream.",
    isEarned: (s) => s.totalSolved >= 25,
  },
  {
    id: "opening-act",
    name: "Opening Act",
    emoji: "🎫",
    description: "Finish 15 lessons. You play to a half-empty room that's only there for the band after you.",
    isEarned: (s) => s.lessonsCompleted >= 15,
  },
  {
    id: "local-radio",
    name: "Local Radio Airplay",
    emoji: "📻",
    description: "Solve 75 questions. A college station played you once at 2 a.m. You've made it, per your dad.",
    isEarned: (s) => s.totalSolved >= 75,
  },
  {
    id: "van-tour",
    name: "The Van Tour",
    emoji: "🚐",
    description: "Solve 150 questions. Five people, one van, zero working suspension. This is rock and roll.",
    isEarned: (s) => s.totalSolved >= 150,
  },
  {
    id: "club-headliner",
    name: "Club Headliner",
    emoji: "🎟️",
    description: "Finish 40 lessons. Your name's on the marquee — in the second-smallest font they had.",
    isEarned: (s) => s.lessonsCompleted >= 40,
  },
  {
    id: "opening-for-your-favorite-band",
    name: "Opening for Your Favorite Band",
    emoji: "🌟",
    description: "Solve 300 questions. Their fans hate you on principle. Worth every second of it.",
    isEarned: (s) => s.totalSolved >= 300,
  },
  {
    id: "sold-out-arena",
    name: "Sold-Out Arena Show",
    emoji: "🏟️",
    description: "Finish 100 lessons. Pyro, a confetti cannon, and your mom finally admitting this is a real job.",
    isEarned: (s) => s.lessonsCompleted >= 100,
  },
  {
    id: "festival-headliner",
    name: "Headlining the Big Festival",
    emoji: "🎆",
    description:
      "Finish every lesson available. Fireworks, 100,000 fans, and a rider that's just extremely specific about snacks.",
    isEarned: (s) => s.totalLessons > 0 && s.lessonsCompleted >= s.totalLessons,
  },
];

export function earnedBadges(stats: MathProgressStats): MathBadge[] {
  return MATH_BADGES.filter((b) => b.isEarned(stats));
}
