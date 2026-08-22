// The curated /school library's index — metadata only (the actual beat data
// lives in the `lessons` table, seeded by scripts/seedLessons.mts). Kept as a
// plain array in code, not a query, so the /school index page can list
// lessons in order without a round trip. Mirrors famousSongs.ts, but ordered
// as a stepwise curriculum (lessonNumber) instead of a flat list of songs.
export interface DrumLesson {
  slug: string;
  lessonNumber: number;
  title: string;
  teaches: string;
}

export const DRUM_LESSONS: DrumLesson[] = [
  { slug: "lesson-1-the-pulse", lessonNumber: 1, title: "Find the Pulse", teaches: "Steady quarter notes on the hi-hat." },
  { slug: "lesson-2-the-backbeat", lessonNumber: 2, title: "Add the Backbeat", teaches: "Snare on beats 2 and 4." },
  { slug: "lesson-3-the-kick", lessonNumber: 3, title: "Add the Kick", teaches: "Bass drum on beats 1 and 3 — the basic rock beat." },
  { slug: "lesson-4-eighth-note-hihat", lessonNumber: 4, title: "Eighth-Note Hi-Hat", teaches: "Doubling the hi-hat for a driving feel." },
  { slug: "lesson-5-syncopated-kick", lessonNumber: 5, title: "Syncopate the Kick", teaches: "Moving a kick hit onto the off-beat." },
  { slug: "lesson-6-fast-drive", lessonNumber: 6, title: "Fast Straight-Eighth Drive", teaches: "A driving, uptempo groove with the kick on every beat." },
  { slug: "lesson-7-open-hihat", lessonNumber: 7, title: "Open Hi-Hat Accents", teaches: "Opening and closing the hi-hat for a splashy accent." },
  { slug: "lesson-8-tom-fill", lessonNumber: 8, title: "Your First Fill: The Tom Run", teaches: "A one-bar fill that walks down the toms." },
  { slug: "lesson-9-eighth-fill", lessonNumber: 9, title: "Eighth-Note Fill", teaches: "Breaking just the last beat into a quick snare fill." },
  { slug: "lesson-10-put-it-together", lessonNumber: 10, title: "Put It Together", teaches: "Verse, chorus, and fills arranged into one song." },
  { slug: "lesson-11-sixteenth-note-hihat", lessonNumber: 11, title: "Sixteenth-Note Hi-Hat", teaches: "Subdividing the hi-hat into sixteenths for a smoother, busier feel." },
  { slug: "lesson-12-ghost-notes", lessonNumber: 12, title: "Ghost Notes", teaches: "Quiet snare hits between the backbeat, for texture instead of volume." },
  { slug: "lesson-13-train-beat", lessonNumber: 13, title: "The Train Beat", teaches: "A driving eighth-note pattern voiced on the snare, with the downbeat of each pair accented for a chugging feel." },
  { slug: "lesson-14-halftime-groove", lessonNumber: 14, title: "Halftime Groove", teaches: "Moving the snare to just beat 3 for a laid-back, spacious feel." },
  { slug: "lesson-15-double-time-feel", lessonNumber: 15, title: "Double-Time Feel", teaches: "The same basic rock beat, played fast enough to feel like a different gear." },
  { slug: "lesson-16-the-shuffle", lessonNumber: 16, title: "The Shuffle", teaches: "A swung, triplet-based hi-hat feel instead of straight time." },
  { slug: "lesson-17-funk-sixteenth-groove", lessonNumber: 17, title: "Funk Sixteenth Groove", teaches: "Syncopating the kick within a sixteenth-note grid, plus ghost notes." },
  { slug: "lesson-18-linear-fill", lessonNumber: 18, title: "Linear Fill", teaches: "A fill where no two limbs ever hit at the same instant, versus one that stacks hits together." },
  { slug: "lesson-19-sixteenth-note-fill", lessonNumber: 19, title: "Sixteenth-Note Fill", teaches: "Filling the last beat with a running sixteenth-note cascade instead of quarter notes." },
  { slug: "lesson-20-crash-into-the-groove", lessonNumber: 20, title: "Crash Into the Groove", teaches: "Using a pickup fill and a crash-plus-kick hit together to mark a new section." },
  { slug: "lesson-21-odd-grouping", lessonNumber: 21, title: "Odd Grouping: 3+3+2", teaches: "Splitting a bar of eighth notes into groups of 3+3+2 instead of four even beats." },
  { slug: "lesson-22-the-one-drop", lessonNumber: 22, title: "The One-Drop", teaches: "Landing the kick and snare together on beat 3 instead of spreading them across the bar." },
  { slug: "lesson-23-disco-four-on-the-floor", lessonNumber: 23, title: "Disco Four-on-the-Floor", teaches: "Kick on every beat, with the hi-hat opening on each off-beat for color." },
  { slug: "lesson-24-cross-stick-backbeat", lessonNumber: 24, title: "Cross-Stick Backbeat", teaches: "A quieter rimshot backbeat for a verse, opening up to full snare for the chorus." },
  { slug: "lesson-25-building-dynamics", lessonNumber: 25, title: "Building Dynamics: Verse to Chorus", teaches: "Leaving the snare out entirely in a sparse verse, so the chorus has somewhere to go." },
  { slug: "lesson-26-the-big-fill", lessonNumber: 26, title: "The Big Fill", teaches: "A fill that takes over the entire bar, for a bigger moment than a one-beat tom run." },
  { slug: "lesson-27-sixteenth-note-kick", lessonNumber: 27, title: "Sixteenth-Note Kick Pattern", teaches: "A funk/hip-hop-style kick pattern built from sixteenth-note syncopation." },
  { slug: "lesson-28-odd-meter-groove", lessonNumber: 28, title: "7-Beat Groove", teaches: "An asymmetric 3+2+2 grouping across a 7-beat measure, instead of four even beats." },
  { slug: "lesson-29-full-arrangement", lessonNumber: 29, title: "Full Arrangement: Verse, Chorus, Fills", teaches: "Combining a halftime verse, a driving chorus, and two fills into one arranged song." },
  { slug: "lesson-30-graduation", lessonNumber: 30, title: "Graduation: A Song of Your Own", teaches: "Verse, chorus, and bridge grooves plus a fill — everything from this course, in one song." },
];
