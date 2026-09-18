// Single source of truth for the facts search engines and LLM answer
// engines read about RockBlocks. The same entity definition, feature list,
// how-to steps and FAQ feed the page copy (HomeContent, the /about page),
// the JSON-LD graphs below, and public/llms.txt — keeping one consistent
// story everywhere is most of what "GEO" actually asks for.

import { gradeLabel } from "@/lib/mathSchool";
import { gradeByNumber as rockWordsGradeByNumber } from "@/lib/rockWords";

export const SITE_URL = "https://rockblocks.app";
export const SITE_NAME = "RockBlocks";

// The canonical one-paragraph answer to "what is RockBlocks?" — entity
// first, then the facts an answer engine latches onto (free, in-browser,
// no login) and the positioning (anyone can play it — kids through working
// musicians — regular and odd time signatures).
export const ENTITY_DESCRIPTION =
  "RockBlocks is a free, browser-based drum machine and beat maker. You build a beat by dragging rhythmic values into a grid of beat blocks — one row per drum piece — in any time signature, regular or odd. A one-click generator also spins up fresh, original beats in regular or odd meter, and can add a matching bass line that follows the groove. It runs entirely in a web browser with no login, download, or install, and it is designed so anyone can use it: a young child tapping out a first rhythm, or a working musician sketching a drum part in 7/8.";

export const SHORT_TAGLINE = "A drum machine anyone can play.";

// Brand-level description — covers the company/idea, not just the web app,
// so the physical instrument is part of the entity from the start.
export const BRAND_DESCRIPTION =
  "RockBlocks is a reimagined drum machine that anyone can play, from young children to professional musicians. It is a free web app today, and a physical instrument for toy shops and music stores in the future.";

export const FEATURE_LIST: string[] = [
  "Drag rhythmic values (quarter notes, eighths, sixteenths, triplets and more) into a grid of beat blocks — one row per drum piece",
  "Build beats in regular or odd time signatures (3/4, 5/4, 7/8 and beyond), up to 8 beats per bar",
  "Play through several classic drum-machine kits (TR-808, LinnDrum LM-2, Roland CR-8000, MFB-512, Casio RZ-1) plus an acoustic kit and a synthesized novelty kit",
  "Two ways to build a beat: RockBlocks' own beat-block grid — one block per beat, drag in a rhythm tile — or a Classic view, a familiar 16-step drum-machine sequencer grid for the exact same pattern; switch anytime, and an edit in either view shows up instantly in the other",
  "Inspiration generator: in a few clicks, spin up a fresh, unique beat in a regular or odd time signature — or a groove variation, fill, or human-playable drum solo from an existing beat, with a complexity dial",
  "Generated bass lines: add a bass part that follows your beat's kick and snare — choose the key, scale (major, minor, modes, pentatonic, blues, jazz and more), octave, how busy the walking line is, and one of five synth bass tones (fingered, pick, upright/double bass, synth sub, muted dub); change key, scale, octave, and volume on the fly or re-roll for a new line",
  "TextyBeat: paste a sentence and get a drum groove generated from its word rhythm, deterministically",
  "Stacks: arrange repeats of your beats into a longer, full-song arrangement",
  "Save a beat to a personal no-login page at rockblocks.app/YourName, or share any pattern by link",
  "Export a beat — with its generated bass line, or drums only — as an MP3 or a MIDI file",
  "Use your beats to power AI music: export an MP3 to seed a track in Suno, Udio, or Riffusion, or export MIDI to build the drums (and bass) in a DAW",
  "Fractal Art: turn a beat into generative line art — one continuous, colored layer per drum piece, drawing itself in time with the music — in a dark or light background and five visual styles (Classic, Bloom, Vignette, Vivid, Prism)",
  "Export a share-ready video of a beat's Fractal Art — vertical (9:16) for TikTok and Instagram Reels, or square (1:1) — with the beat's own sheet music and a live playhead overlaid, an optional RockBlocks logo, and a 7–15 second clip length",
  "Drum School: 100 free stepwise lessons that build a full groove one idea at a time",
  "RockBlocks Math: a free, grade-aligned (Kindergarten-Grade 12) math curriculum where each lesson pairs a math concept with a drum pattern built to correlate with it",
  "RockWords: a free, grade-tailored (Kindergarten-Grade 12) Wordle-style word game where every guess builds part of a real, physically-playable drum pattern — right letters hit hard, wrong letters still get a real drum hit, vowels add their own drum color, and a live dictionary check keeps every guess a real word",
];

export const HOW_TO_STEPS: { name: string; text: string }[] = [
  {
    name: "Pick a drum row",
    text: "Each row is one drum piece — bass drum, snare, hi-hat, and more. Start with the bass drum row.",
  },
  {
    name: "Drop rhythm tiles into the beat blocks",
    text: "Drag a rhythmic value (a quarter note, two eighths, a triplet) into a beat block, or tap a tile then tap a block. Each block is one beat.",
  },
  {
    name: "Add the snare and hi-hat",
    text: "Fill the other rows the same way. A basic rock beat is bass drum on 1 and 3, snare on 2 and 4, steady hi-hats throughout.",
  },
  {
    name: "Set the time signature and tempo",
    text: "Add or remove beat blocks to change the bar length — try 5 or 7 for an odd time signature — and set the BPM in the transport bar.",
  },
  {
    name: "Generate a beat or a bass line in a few clicks (optional)",
    text: "Use the Inspiration generator for a fresh, unique beat — in any meter — or a variation, fill, or solo from what you have. Open Bassline to generate a bass part that follows your kick and snare; pick a key and scale, and change key, scale, octave, or how busy it is without regenerating.",
  },
  {
    name: "Play, save, or share it",
    text: "Press play to hear the loop. Save it to your own page, arrange several beats into a song with Stacks, or export an MP3 or MIDI file — with the bass line or drums only.",
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is RockBlocks?",
    a: "RockBlocks is a free online drum machine and beat maker that runs in your web browser. You build a drum beat by dragging rhythmic values into a grid of beat blocks, one row per drum piece, then press play. There is no login, download, or install.",
  },
  {
    q: "Is RockBlocks free?",
    a: "Yes. Every feature — building beats, generating beats and bass lines, all the drum kits, TextyBeat, Stacks song arrangement, MP3 and MIDI export, saving to your own page, and the 100 Drum School lessons — is free, with no account required.",
  },
  {
    q: "Do I need to download or install anything?",
    a: "No. RockBlocks runs entirely in a modern web browser on a computer, tablet, or phone. Nothing is installed.",
  },
  {
    q: "Can children use RockBlocks?",
    a: "Yes — that is a core part of the design. Placing tiles into beat blocks is simple enough for a young child to make a real beat on their first try, while still giving musicians odd time signatures, triplets, ghost notes, and accents.",
  },
  {
    q: "Can I make beats in odd time signatures?",
    a: "Yes. You can set any bar length from 3 to 8 beats, so 3/4, 5/4, 7/8, and less common meters all work. This is one of the main reasons musicians use RockBlocks to sketch drum parts. The Inspiration generator and generated bass lines work in odd meters too, so you can spin up a unique 5/4 or 7/8 groove with a matching bass part in a few clicks.",
  },
  {
    q: "How do I make a drum beat?",
    a: "Drag a rhythmic value into a beat block on a drum row, or tap a tile then tap a block. Put the bass drum on beats 1 and 3, the snare on 2 and 4, and hi-hats on every beat for a basic rock groove, then press play.",
  },
  {
    q: "What drum kits does RockBlocks have?",
    a: "Classic drum-machine sample sets including the Roland TR-808, LinnDrum LM-2, Roland CR-8000, MFB-512, and Casio RZ-1, plus an acoustic kit and a synthesized novelty kit.",
  },
  {
    q: "Can RockBlocks turn text into a beat?",
    a: "Yes. The TextyBeat tool takes a sentence and generates a drum groove from its word and syllable rhythm. The same text always produces the same beat.",
  },
  {
    q: "Can RockBlocks generate a beat for me?",
    a: "Yes. The Inspiration generator makes a fresh, original beat in a few clicks — in a regular or an odd time signature — and can also hand you a groove variation, a fill, or a human-playable drum solo based on a beat you already have, with a 1–10 complexity dial. Every generation is new; run it again for another.",
  },
  {
    q: "Can RockBlocks add a bass line to my beat?",
    a: "Yes. RockBlocks can generate a bass line that follows your beat's kick and snare. You choose the key, the scale (major, minor, modes, pentatonic, blues, jazz, and more), the octave, and how busy the walking line is, plus one of five synthesized bass tones: fingered electric, pick, upright/double bass, synth sub, or muted dub. Key, scale, octave, and volume can be changed on the fly without regenerating, and the bass line is included in the MP3 and MIDI export (or you can export the bass on its own).",
  },
  {
    q: "Can I export or share my beat?",
    a: "Yes. Export any beat — with its generated bass line, or drums only — as an MP3 or a MIDI file, save it to a personal page at rockblocks.app/YourName, or share a pattern with a link.",
  },
  {
    q: "Can I make an 808 beat?",
    a: "Yes. Choose the TR-808 kit and build a pattern the same way you would with any kit. RockBlocks also has LinnDrum LM-2, Roland CR-8000, MFB-512, and Casio RZ-1 sample sets, plus an acoustic kit.",
  },
  {
    q: "Does RockBlocks work on an iPad or a phone?",
    a: "Yes. It runs in the mobile browser on iPad, iPhone, and Android. Tap a rhythm tile, then tap a beat block to place it.",
  },
  {
    q: "Can I use RockBlocks beats in my own music?",
    a: "Yes. Beats you make are yours to use. Export them as an MP3 or a MIDI file and drop them into a track, a video, or a project.",
  },
  {
    q: "Can I use RockBlocks beats with Suno or other AI music tools?",
    a: "Yes. Export a beat as an MP3 and upload it as the audio input for Suno, Udio, or Riffusion so the generated song follows your drum pattern, or export MIDI to build the drums in a DAW first. Starting an AI song from a real drum groove gives it a rhythmic backbone a text prompt alone usually can't. See the AI music guide at rockblocks.app/ai-music.",
  },
  {
    q: "Does RockBlocks have a classic step sequencer?",
    a: "Yes. Switch to Classic view and every beat becomes a familiar 16-step on/off grid, one row per drum piece — the same pattern you can also edit as RockBlocks' own draggable rhythm-tile blocks. An edit in either view applies to the same beat instantly; nothing needs to be rebuilt.",
  },
  {
    q: "How is RockBlocks different from a step sequencer?",
    a: "A classic step sequencer gives you a fixed grid of on/off steps, and RockBlocks' Classic view is exactly that. Its own beat-block view goes further: one block per beat and a palette of rhythm values — quarter notes, triplets, sixteenth runs — that you drag in, so one beat can hold any rhythm and a bar can be any length for odd time signatures. Both views edit the same beat, so you can use whichever fits the moment.",
  },
  {
    q: "Can RockBlocks turn my beat into a video?",
    a: "Yes. Fractal Art turns a beat into generative line art — one flowing, colored layer per drum piece, drawing itself in time with the music — and you can export it as a short vertical or square video, with the beat's own sheet music and a live playhead overlaid, ready to post to TikTok, Instagram Reels, or anywhere else.",
  },
  {
    q: "Can I make a TikTok or Instagram Reel from my beat?",
    a: "Yes. Open Fractal Art, then Share Video, pick a vertical (9:16) or square (1:1) aspect ratio, a background and visual style, and a clip length from 7 to 15 seconds, then record. The export is a standard MP4 with your beat's audio, built to upload straight to TikTok or Instagram Reels, with an optional RockBlocks logo you can turn off.",
  },
  {
    q: "Is there a physical RockBlocks?",
    a: "A physical RockBlocks instrument for toy shops and music stores is planned. The web app is the same idea you can use today for free.",
  },
  {
    q: "Does RockBlocks teach math?",
    a: "Yes. RockBlocks Math is a free, grade-aligned math curriculum (Kindergarten through Grade 12) built into RockBlocks. Each lesson pairs a math concept with a worked-example drum beat, then has you build the answer yourself in a real, playable pattern. See rockblocks.app/math.",
  },
  {
    q: "Is there a word game built into RockBlocks?",
    a: "Yes. RockWords is a free, grade-tailored (Kindergarten through Grade 12) Wordle-style word game where every guess builds part of a real, playable RockBlocks drum pattern. See rockblocks.app/rockwords.",
  },
];

// --- AI music workflow (the /ai-music pillar page) --------------------
// People search for how to make their Suno / Udio / Riffusion tracks less
// generic. RockBlocks' answer: design the drum part yourself and hand it to
// the model as an audio seed (MP3) or a DAW part (MIDI). Same single-source
// pattern as everything above — these feed the page copy, its JSON-LD, and
// public/llms.txt.

export const AI_MUSIC_DESCRIPTION =
  "You can use RockBlocks to make the drum track for AI music. Build or generate a beat — odd time signatures, triplets, ghost notes, accents, fills, and a complexity dial all help — then export it as an MP3 to use as the audio input for Suno, Udio, Riffusion, or another AI music generator, or export it as a MIDI file to drop into a DAW. You can also generate a bass line that locks to the beat and include it in the export, so the model has both the rhythm and the low end to build on. Starting an AI song from a real, deliberate drum-and-bass pattern gives it a foundation that a text prompt alone usually can't.";

export const AI_MUSIC_STEPS: { name: string; text: string }[] = [
  {
    name: "Build or generate a beat with intent",
    text: "Make the groove in RockBlocks and reach for what a text prompt can't specify: an odd time signature like 7/8, a triplet feel, ghost notes and accents, a fill into the chorus. Start from scratch, from the Inspiration generator with its complexity dial turned up, from TextyBeat, or from a famous-song pattern.",
  },
  {
    name: "Add a bass line (optional)",
    text: "Open Bassline and generate a bass part that follows the kick and snare. Set the key and scale, dial the walking line busier or simpler, and pick a tone — upright, fingered electric, synth sub. It gives the AI a harmonic root alongside the rhythm.",
  },
  {
    name: "Export an MP3 of the pattern",
    text: "Use MP3 export to get an audio file of just your pattern — drums alone, or drums plus the generated bass line — looped to the length you want.",
  },
  {
    name: "Upload it as the audio input",
    text: "In Suno, Udio, Riffusion, or your AI tool of choice, start a track from an uploaded audio clip (upload / cover / extend / \"add instrumental\") with your drum MP3 as the seed. Check each tool's current clip-length limit. The model then builds the song around your rhythm instead of inventing a generic one.",
  },
  {
    name: "Or export MIDI for a DAW",
    text: "Export the beat as a MIDI file, load it into a DAW with your own drum samples, render stems, and feed those to the AI tool — or keep the AI's vocals and instruments and swap in your MIDI-triggered drums at mixdown.",
  },
  {
    name: "Iterate on the groove, not the prompt",
    text: "If the AI result feels stiff or wrong, change the beat in RockBlocks — more syncopation, a different meter, a busier fill — re-export, and run it again. The drum pattern is the part you can control precisely.",
  },
];

export const AI_MUSIC_FAQ: { q: string; a: string }[] = [
  {
    q: "Can I use RockBlocks beats with Suno?",
    a: "Yes. Export your beat from RockBlocks as an MP3 and upload it as the audio input for a Suno track (via upload, cover, or extend). Suno builds the song around your drum pattern, which gives it a tighter, more intentional rhythm than a text prompt alone. MIDI export works too if you want to run the drums through a DAW first.",
  },
  {
    q: "How do I make my Suno or Udio songs more rhythmically complex?",
    a: "Give the model a drum track to follow instead of letting it guess. Build a beat in RockBlocks in an odd time signature, with triplets, ghost notes, accents, and fills — or turn up the Inspiration generator's complexity dial — export it as an MP3, and use it as the audio seed for the AI song. The generated track inherits the groove you designed.",
  },
  {
    q: "What AI music tools work with RockBlocks exports?",
    a: "Any tool that accepts an uploaded audio clip or a MIDI file. That includes Suno, Udio, and Riffusion for audio seeds, and any DAW-based AI plugin for MIDI. Use the MP3 export as an audio seed, or the MIDI export as a drum part in a DAW.",
  },
  {
    q: "Can I include a bass line in the track I seed an AI song with?",
    a: "Yes. RockBlocks can generate a bass line that follows your beat, and both the MP3 and the MIDI export can include it. Handing the model a locked rhythm-and-bass foundation constrains the groove and the harmony together, not just the drums — the generated song has a root to move against.",
  },
  {
    q: "Should I upload an MP3 or a MIDI file to an AI music generator?",
    a: "Upload the MP3 when the tool takes an audio seed directly (Suno, Udio, Riffusion). Use the MIDI file when you want to trigger your own drum samples in a DAW, render stems, or line the drums up with other MIDI parts before involving the AI tool.",
  },
  {
    q: "Why start an AI song from a drum beat?",
    a: "Text prompts describe a vibe; they don't specify where the kick and snare land, what the fill does, or that the song is in 5/4. Starting from an actual drum pattern locks in the rhythm section, so the AI fills in melody, harmony, and arrangement over a foundation you chose.",
  },
];

// --- Fractal Art & video export (the /fractal-art pillar page) --------
// People search for how to turn a beat into something postable — a TikTok
// video, a Reel, a visualizer. RockBlocks' answer: Fractal Art renders the
// beat as generative line art and exports a share-ready clip. Same
// single-source pattern as AI music above.

export const FRACTAL_ART_DESCRIPTION =
  "Fractal Art turns any RockBlocks beat into generative line art: each drum piece draws its own continuous, colored layer, its shape built from the beat's own rhythm, looping in sync with the music. Watch it live, or export a short, share-ready video — vertical (9:16) for TikTok and Instagram Reels, or square (1:1) — with a dark or light background, a choice of five visual styles (Classic, Bloom, Vignette, Vivid, Prism), and the beat's own sheet music with a live playhead overlaid. It is a free way to turn a drum pattern into something visual and postable, with no video editor and no account required.";

export const FRACTAL_ART_STEPS: { name: string; text: string }[] = [
  {
    name: "Build or generate a beat",
    text: "Any RockBlocks pattern works — hand-built, from the Inspiration generator, from TextyBeat, or a famous-song pattern. Fractal Art draws from whatever is currently on screen.",
  },
  {
    name: "Open Fractal Art",
    text: "From the tools menu, open Fractal Art to see the live visualization: one drawing layer per drum piece, colored to match, looping with the beat.",
  },
  {
    name: "Pick a background and a style",
    text: "Choose a dark (glow) or light (ink) background, then a visual style — Classic, a soft Bloom halo, a poster-like Vignette, a saturated glowing Vivid, or a rainbow-fringed Prism.",
  },
  {
    name: "Open Share Video",
    text: "Pick a vertical 9:16 (TikTok, Instagram Reels) or square 1:1 aspect ratio, a clip length from 7 to 15 seconds, and whether the RockBlocks logo shows in the corner.",
  },
  {
    name: "Record",
    text: "RockBlocks records a real-time-lapse clip: the artwork clears and rebuilds itself across the whole clip, opening on a brief flash of the finished piece, with your beat's audio and its sheet music (playhead included) baked in.",
  },
  {
    name: "Download and post",
    text: "Download the finished MP4 and upload it to TikTok, Instagram Reels, or anywhere else — it's a standard video file, yours to use.",
  },
];

export const FRACTAL_ART_FAQ: { q: string; a: string }[] = [
  {
    q: "What is Fractal Art?",
    a: "Fractal Art is a RockBlocks feature that turns a drum beat into generative line art. Each drum piece — kick, snare, hi-hat, and the rest — draws its own continuous, colored layer, its shape derived from the beat's own rhythm, looping in time with the music.",
  },
  {
    q: "Can I export the Fractal Art visualization as a video?",
    a: "Yes. Open Fractal Art, then Share Video, and record a 7–15 second clip. It's rendered as a real MP4 with the beat's audio, the artwork's time-lapse reveal, and the beat's sheet music with a live playhead — ready to download and post.",
  },
  {
    q: "What video sizes does RockBlocks export for social media?",
    a: "Vertical 9:16, sized for TikTok and Instagram Reels, and square 1:1. Both bake in the beat's audio, a choice of background and visual style, and the beat's own sheet music.",
  },
  {
    q: "Can I remove the RockBlocks logo from my exported video?",
    a: "Yes. The Share Video panel has a \"Show RockBlocks logo\" option, on by default, that you can turn off before recording.",
  },
  {
    q: "Will the exported video work on TikTok and Instagram?",
    a: "Yes. It exports a standard MP4 (H.264 video, AAC audio) built to upload cleanly to TikTok and Instagram Reels.",
  },
  {
    q: "Is the Fractal Art video export free?",
    a: "Yes. Fractal Art, every visual style, and the video export are free, with no account and no watermark beyond the optional RockBlocks logo you can turn off.",
  },
];

export const ROCKWORDS_DESCRIPTION =
  "RockWords is a free, grade-tailored Wordle-style word game for Kindergarten through Grade 12 that turns every guess into part of a real, physically-playable RockBlocks drum pattern. A right letter in the right spot hits hard, a right letter in the wrong spot lands just off the beat, a wrong letter still gets a real drum hit instead of going silent, and any vowel you guess adds its own drum color — built so it never asks for more than two hands and a foot, the same as a real drummer. Word length climbs with grade level (3 letters in Kindergarten up to 11 in Grade 12), with vocabulary difficulty carrying the rest of the increase. Finishing a round hands the beat straight into the real RockBlocks editor — no login required, and it saves to your account automatically if you're signed in.";

export const ROCKWORDS_STEPS: { name: string; text: string }[] = [
  {
    name: "Pick a grade",
    text: "Kindergarten through Grade 12 are all playable, each with its own word length and vocabulary level — start wherever fits.",
  },
  {
    name: "Guess the word",
    text: "Type letters and press Enter. Right letter, right spot turns green; right letter, wrong spot turns amber; wrong letters turn gray — the same colors as any Wordle-style game.",
  },
  {
    name: "Watch the beat build",
    text: "Every guess adds to a real drum pattern as you go: correct letters hit the snare or a tom, wrong letters land on the kick instead of going silent, and the pattern plays back automatically after each guess.",
  },
  {
    name: "Use the clue — or a hint — if you're stuck",
    text: "A clue is always one tap away, hidden by default so it's optional rather than given away. Grade 4 and up (the 7-letter-and-longer words) also get a few free hints that reveal one letter's position without using up a guess.",
  },
  {
    name: "Solve it (or run out of guesses)",
    text: "Either way, you've built a complete, playable drum pattern out of nothing but how you guessed.",
  },
  {
    name: "Keep the beat going",
    text: "Signed in, it saves straight to your account as a new song. Not signed in, it carries over to the main RockBlocks editor instead — no login required either way.",
  },
];

export const ROCKWORDS_FAQ: { q: string; a: string }[] = [
  {
    q: "What is RockWords?",
    a: "RockWords is a free, grade-tailored Wordle-style word-guessing game built into RockBlocks. Every guess you make turns into part of a real, playable drum pattern — right letters hit hard, wrong letters still get a real drum hit instead of silence, and vowels add their own drum color.",
  },
  {
    q: "What grades does RockWords cover?",
    a: "Kindergarten through Grade 12. Word length grows with grade level (3 letters in Kindergarten up to 11 in Grade 12), and vocabulary difficulty increases alongside it.",
  },
  {
    q: "Why do some grades only get 4 guesses instead of 6 or 8?",
    a: "A RockBlocks pattern maxes out at 8 beats. Words up to 6 letters fit in a single beat per guess, so those grades (Kindergarten-Grade 3) use whichever guess count is configured. Grade 4 and up use words long enough that each guess needs two beats, so those grades always play with 4 guesses (4 × 2 = 8) no matter the setting.",
  },
  {
    q: "How is RockWords still winnable with 4 guesses at an 11-letter word?",
    a: "Every grade that's capped at 4 guesses also gets free hints — 1 hint for 7-8 letter words, 2 for 9-10, and 3 for the 11-letter Grade 12 words. A hint reveals one letter's exact position for free and never uses up a guess (or the beat that guess would have added), so it's extra help on top of the guess budget rather than a trade against it.",
  },
  {
    q: "Is the beat generated by RockWords actually playable on a real drum kit?",
    a: "Yes. The generator never asks for more than one kick (a foot) plus one hit apiece from two hands at any instant — extra colors like toms and a crash cymbal always substitute for a hand's part rather than stacking on top of it.",
  },
  {
    q: "Does RockWords check that a guess is a real word?",
    a: "Yes. Every guess is checked against a live dictionary before it's accepted, so a guess has to be a real English word — genuinely educational, not just a puzzle mechanic.",
  },
  {
    q: "Do I need an account to play RockWords?",
    a: "No. RockWords works with no login. Finish a round and it hands your beat straight into the main RockBlocks editor; sign in first and it instead saves directly to your account as a new song.",
  },
  {
    q: "Is RockWords free?",
    a: "Yes. Every grade, every round, and taking the resulting beat into the full RockBlocks editor are all free, with no account required.",
  },
];

// --- RockBlocks Math (the /math pillar page) ---------------------------
// People search for a free way to practice or teach K-12 math that isn't a
// worksheet. RockBlocks' answer: pair every lesson with a worked-example
// drum beat, then have the student build and hear their own answer. Same
// single-source pattern as AI music, Fractal Art, and RockWords above.

export const MATH_DESCRIPTION =
  "RockBlocks Math is a free, grade-aligned math curriculum taught through drumming, covering Kindergarten through Grade 12. Each grade has 24 lessons that pair a math concept — counting, addition, subtraction, multiplication, fractions, decimals, ratios, equations, exponents, slope, the Pythagorean theorem, geometry, trigonometry, systems of equations, quadratics, complex numbers, logarithms, matrices, vectors, statistics, and an intro to limits — with a worked-example drum beat built to correlate with it. The student then builds the answer themselves in a real, playable RockBlocks beat and checks it against the correct answer. No login or download is required to try it; signed in, a solved count and a set of gig-themed badges are saved per grade.";

export const MATH_STEPS: { name: string; text: string }[] = [
  {
    name: "Pick a grade",
    text: "Kindergarten through Grade 12 are all playable, each with its own 24-lesson track — start wherever fits.",
  },
  {
    name: "Read the worked example",
    text: "Every lesson introduces one math concept with a worked example, shown as a real drum beat built to correlate with the idea being taught.",
  },
  {
    name: "Build the answer as a beat",
    text: "Drag rhythm tiles into the grid so the beat matches the correct answer — a note count, or for multiplication and ratios, a number of rhythm blocks holding a number of notes each — then press play to check it.",
  },
  {
    name: "Get instant feedback",
    text: "A correct answer plays back as a reward and unlocks the next lesson; an incorrect one explains why, right on the page.",
  },
  {
    name: "Keep exploring",
    text: "Every math answer is a real RockBlocks pattern — change the kit, view it as sheet music, drop it into a Stack, or export it, the same as any other beat.",
  },
  {
    name: "Track progress (optional)",
    text: "Sign in and your solved count and a set of gig-themed badges are saved per grade; no account is required to use any lesson.",
  },
];

export const MATH_FAQ: { q: string; a: string }[] = [
  {
    q: "What is RockBlocks Math?",
    a: "RockBlocks Math is a free, grade-aligned math curriculum built into RockBlocks. Each lesson pairs a math concept with a worked-example drum beat, then has you build the answer yourself in a real, playable RockBlocks pattern.",
  },
  {
    q: "What grades does RockBlocks Math cover?",
    a: "Kindergarten through Grade 12, with 24 lessons per grade — from counting and place value up through trigonometry, quadratics, logarithms, matrices, vectors, and an intro to limits.",
  },
  {
    q: "Is RockBlocks Math free?",
    a: "Yes. Every grade and every lesson is free, with no account required to try it.",
  },
  {
    q: "Do I need an account to use RockBlocks Math?",
    a: "No. Any lesson works with no login. Signing in adds a per-grade solved count and a set of gig-themed badges as you work through lessons.",
  },
  {
    q: "How does building the answer as a drum beat work?",
    a: "Each lesson's prompt tells you what to build — for example, a certain number of notes, or for multiplication and ratios, a certain number of rhythm blocks holding a certain number of notes each. You drag rhythm tiles into the real RockBlocks grid until the beat matches, then press play; a correct answer plays back as a reward.",
  },
  {
    q: "Is RockBlocks Math a worksheet replacement?",
    a: "It's built as an alternative to a worksheet: the same math practice, but the answer is a real, audible drum pattern you build and hear instead of a number you write down.",
  },
];

type Json = Record<string, unknown>;

const organizationLd: Json = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon`,
  description: BRAND_DESCRIPTION,
  slogan: SHORT_TAGLINE,
};

const webSiteLd: Json = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  description: ENTITY_DESCRIPTION,
  publisher: { "@id": `${SITE_URL}/#organization` },
};

const softwareApplicationLd: Json = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  applicationSubCategory: "Drum machine",
  operatingSystem: "Any (runs in a web browser)",
  browserRequirements: "Requires a modern web browser with JavaScript and Web Audio",
  description: ENTITY_DESCRIPTION,
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": `${SITE_URL}/#organization` },
  featureList: FEATURE_LIST,
  audience: {
    "@type": "Audience",
    audienceType: "Musicians, songwriters, drummers, music teachers, students, hobbyists, and children",
  },
};

// Root layout graph — the site-wide entity facts.
export const rootJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [organizationLd, webSiteLd, softwareApplicationLd],
};

const faqPageLd: Json = {
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const howToLd: Json = {
  "@type": "HowTo",
  name: "How to make a drum beat with RockBlocks",
  description:
    "Make a drum beat online for free by dragging rhythmic values into a grid of beat blocks, one row per drum piece.",
  image: `${SITE_URL}/opengraph-image`,
  totalTime: "PT2M",
  step: HOW_TO_STEPS.map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: s.name,
    text: s.text,
  })),
};

// Homepage graph — layered on top of the root graph.
export const homePageJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: "RockBlocks — Free Online Drum Machine & Beat Maker",
      description: ENTITY_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    },
    howToLd,
    faqPageLd,
  ],
};

// /ai-music graph — the drums-for-AI-music pillar page. WebPage + a HowTo
// for the workflow + an FAQPage, layered on top of the root graph.
export const aiMusicPageJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/ai-music#webpage`,
      url: `${SITE_URL}/ai-music`,
      name: "Drum Beats for Suno & AI Music",
      description: AI_MUSIC_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    },
    {
      "@type": "HowTo",
      name: "How to use RockBlocks drum beats in Suno and other AI music tools",
      description:
        "Make a drum pattern in RockBlocks, export it as an MP3 or MIDI file, and use it as the audio input for an AI music generator so the song follows a rhythm you designed.",
      image: `${SITE_URL}/opengraph-image`,
      totalTime: "PT5M",
      step: AI_MUSIC_STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/ai-music#faq`,
      mainEntity: AI_MUSIC_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

// /fractal-art graph — the beat-to-video pillar page. WebPage + a HowTo for
// the record/export workflow + an FAQPage, layered on top of the root graph.
export const fractalArtPageJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/fractal-art#webpage`,
      url: `${SITE_URL}/fractal-art`,
      name: "Fractal Art — Turn a Beat into a TikTok/Reels Video",
      description: FRACTAL_ART_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    },
    {
      "@type": "HowTo",
      name: "How to turn a RockBlocks beat into a video for TikTok or Instagram Reels",
      description:
        "Record a short, share-ready video of a beat's Fractal Art visualization, with the beat's own audio and sheet music baked in, sized for TikTok and Instagram Reels.",
      image: `${SITE_URL}/opengraph-image`,
      totalTime: "PT3M",
      step: FRACTAL_ART_STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/fractal-art#faq`,
      mainEntity: FRACTAL_ART_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

// /rockwords graph — WebPage + a HowTo for the game loop + an FAQPage,
// layered on top of the root graph. Per-grade pages add their own Course
// JSON-LD (see rockWordsCourseJsonLd below) on top of this.
export const rockWordsPageJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/rockwords#webpage`,
      url: `${SITE_URL}/rockwords`,
      name: "RockWords — A Word Game That Builds a Drum Beat",
      description: ROCKWORDS_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    },
    {
      "@type": "HowTo",
      name: "How to play RockWords",
      description: "Guess a grade-appropriate word and watch every guess turn into part of a real, playable drum pattern.",
      image: `${SITE_URL}/opengraph-image`,
      totalTime: "PT3M",
      step: ROCKWORDS_STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/rockwords#faq`,
      mainEntity: ROCKWORDS_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

// /math graph — WebPage + a HowTo for the lesson loop + an FAQPage, layered
// on top of the root graph. Per-grade Course and per-lesson LearningResource
// JSON-LD (mathCourseJsonLd, mathLessonJsonLd below) sit alongside this on
// the index and lesson pages respectively.
export const mathPageJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/math#webpage`,
      url: `${SITE_URL}/math`,
      name: "RockBlocks Math — Learn Math Through Drumming, Free",
      description: MATH_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    },
    {
      "@type": "HowTo",
      name: "How RockBlocks Math lessons work",
      description:
        "Read a lesson's worked example, then build the answer yourself as a real drum beat in RockBlocks and check it.",
      image: `${SITE_URL}/opengraph-image`,
      totalTime: "PT5M",
      step: MATH_STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/math#faq`,
      mainEntity: MATH_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

// /about graph.
export const aboutPageJsonLd: Json = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about#webpage`,
      url: `${SITE_URL}/about`,
      name: "About RockBlocks",
      description: BRAND_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
    },
    organizationLd,
  ],
};

// /school index — a free course.
export function courseJsonLd(lessonCount: number): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "RockBlocks Drum School",
    url: `${SITE_URL}/school`,
    description: `A free, stepwise beginner drum curriculum — ${lessonCount} lessons that each add one new idea, from the first steady pulse to fills and full arrangements.`,
    provider: { "@id": `${SITE_URL}/#organization` },
    isAccessibleForFree: true,
    inLanguage: "en",
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${Math.max(1, Math.round(lessonCount / 4))}H`,
    },
  };
}

// The whole Drum School curriculum as an ordered list — lets an engine see
// the 100 lessons and their sequence from the index page alone.
export function lessonListJsonLd(
  lessons: { slug: string; lessonNumber: number; title: string }[]
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "RockBlocks Drum School lessons",
    url: `${SITE_URL}/school`,
    numberOfItems: lessons.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: lessons.map((l) => ({
      "@type": "ListItem",
      position: l.lessonNumber,
      url: `${SITE_URL}/school/${l.slug}`,
      name: `Lesson ${l.lessonNumber}: ${l.title}`,
    })),
  };
}

// A single Drum School lesson.
export function lessonJsonLd(lesson: {
  slug: string;
  lessonNumber: number;
  title: string;
  teaches: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: `Lesson ${lesson.lessonNumber}: ${lesson.title}`,
    url: `${SITE_URL}/school/${lesson.slug}`,
    description: lesson.teaches,
    learningResourceType: "Interactive drum lesson",
    educationalLevel: "Beginner",
    isAccessibleForFree: true,
    inLanguage: "en",
    isPartOf: {
      "@type": "Course",
      name: "RockBlocks Drum School",
      url: `${SITE_URL}/school`,
    },
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

// /math grade index — a free course, one per grade level.
export function mathCourseJsonLd(grade: number, lessonCount: number): Json {
  const label = gradeLabel(grade);
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `RockBlocks Math — ${label}`,
    url: `${SITE_URL}/math`,
    description: `A free ${label} math curriculum taught through drumming — ${lessonCount} lessons that each pair a math concept with a drum pattern built to correlate with it.`,
    provider: { "@id": `${SITE_URL}/#organization` },
    isAccessibleForFree: true,
    inLanguage: "en",
    educationalLevel: label,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${Math.max(1, Math.round(lessonCount / 4))}H`,
    },
  };
}

// The whole RockBlocks Math curriculum (all grades) as an ordered list.
export function mathLessonListJsonLd(
  lessons: { slug: string; grade: number; lessonNumber: number; title: string }[]
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "RockBlocks Math lessons",
    url: `${SITE_URL}/math`,
    numberOfItems: lessons.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: lessons.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/math/${l.slug}`,
      name: `${gradeLabel(l.grade)} Lesson ${l.lessonNumber}: ${l.title}`,
    })),
  };
}

// A single RockBlocks Math lesson.
export function mathLessonJsonLd(lesson: {
  slug: string;
  grade: number;
  lessonNumber: number;
  title: string;
  mathSkill: string;
  teaches: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: `${gradeLabel(lesson.grade)} Lesson ${lesson.lessonNumber}: ${lesson.title}`,
    url: `${SITE_URL}/math/${lesson.slug}`,
    description: lesson.teaches,
    learningResourceType: "Interactive math-and-drumming lesson",
    educationalLevel: gradeLabel(lesson.grade),
    teaches: lesson.mathSkill,
    isAccessibleForFree: true,
    inLanguage: "en",
    isPartOf: {
      "@type": "Course",
      name: `RockBlocks Math — ${gradeLabel(lesson.grade)}`,
      url: `${SITE_URL}/math`,
    },
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

function rockWordsGradeLabel(grade: number): string {
  return rockWordsGradeByNumber(grade)?.label ?? `Grade ${grade}`;
}

// One RockWords grade as a Course — mirrors mathCourseJsonLd.
export function rockWordsCourseJsonLd(grade: number, wordCount: number): Json {
  const label = rockWordsGradeLabel(grade);
  const slug = rockWordsGradeByNumber(grade)?.slug ?? String(grade);
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `RockWords — ${label}`,
    url: `${SITE_URL}/rockwords/${slug}`,
    description: `A free ${label} word-guessing game where every guess builds part of a real, playable RockBlocks drum pattern — ${wordCount} words at this grade's own word length and vocabulary level.`,
    provider: { "@id": `${SITE_URL}/#organization` },
    isAccessibleForFree: true,
    inLanguage: "en",
    educationalLevel: label,
  };
}

// Every live RockWords grade as an ordered list — mirrors mathLessonListJsonLd.
export function rockWordsGradeListJsonLd(grades: { grade: number; slug: string; label: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "RockWords grades",
    url: `${SITE_URL}/rockwords`,
    numberOfItems: grades.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: grades.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/rockwords/${g.slug}`,
      name: `RockWords — ${g.label}`,
    })),
  };
}

// Breadcrumb trail for a nested page. Pass the full trail including the
// current page; `url` is a site-relative path.
export function breadcrumbJsonLd(items: { name: string; url: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

// A curated famous-song drum pattern.
export function songJsonLd(song: { slug: string; title: string; artist: string }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: `${song.title} — drum pattern`,
    url: `${SITE_URL}/songs/${song.slug}`,
    description: `The drum beat from "${song.title}" by ${song.artist}, mapped out on RockBlocks — playable, editable, and free.`,
    byArtist: { "@type": "MusicGroup", name: song.artist },
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
