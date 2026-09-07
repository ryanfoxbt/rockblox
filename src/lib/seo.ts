// Single source of truth for the facts search engines and LLM answer
// engines read about RockBlocks. The same entity definition, feature list,
// how-to steps and FAQ feed the page copy (HomeContent, the /about page),
// the JSON-LD graphs below, and public/llms.txt — keeping one consistent
// story everywhere is most of what "GEO" actually asks for.

export const SITE_URL = "https://rockblocks.app";
export const SITE_NAME = "RockBlocks";

// The canonical one-paragraph answer to "what is RockBlocks?" — entity
// first, then the facts an answer engine latches onto (free, in-browser,
// no login) and the positioning (anyone can play it — kids through working
// musicians — regular and odd time signatures).
export const ENTITY_DESCRIPTION =
  "RockBlocks is a free, browser-based drum machine and beat maker. You build a beat by dragging rhythmic values into a grid of beat blocks — one row per drum piece — in any time signature, regular or odd. It runs entirely in a web browser with no login, download, or install, and it is designed so anyone can use it: a young child tapping out a first rhythm, or a working musician sketching a drum part in 7/8.";

export const SHORT_TAGLINE = "A drum machine anyone can play.";

// Brand-level description — covers the company/idea, not just the web app,
// so the physical instrument is part of the entity from the start.
export const BRAND_DESCRIPTION =
  "RockBlocks is a reimagined drum machine that anyone can play, from young children to professional musicians. It is a free web app today, and a physical instrument for toy shops and music stores in the future.";

export const FEATURE_LIST: string[] = [
  "Drag rhythmic values (quarter notes, eighths, sixteenths, triplets and more) into a grid of beat blocks — one row per drum piece",
  "Build beats in regular or odd time signatures (3/4, 5/4, 7/8 and beyond), up to 16 beats per bar",
  "Play through several classic drum-machine kits (TR-808, LinnDrum LM-2, Roland CR-8000, MFB-512, Casio RZ-1) plus an acoustic kit and a synthesized novelty kit",
  "Inspiration generator: create a fresh random beat, or a groove variation, fill, or human-playable drum solo based on an existing beat, with a complexity dial",
  "TextyBeat: paste a sentence and get a drum groove generated from its word rhythm, deterministically",
  "Song import: upload an MP3 and have its drum track transcribed into an editable pattern",
  "Stacks: arrange repeats of your beats into a longer, full-song arrangement",
  "Save a beat to a personal no-login page at rockblocks.app/YourName, or share any pattern by link",
  "Export a beat as an MP3 or a MIDI file",
  "Drum School: 100 free stepwise lessons that build a full groove one idea at a time",
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
    name: "Play, save, or share it",
    text: "Press play to hear the loop. Save it to your own page, arrange several beats into a song with Stacks, or export an MP3 or MIDI file.",
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is RockBlocks?",
    a: "RockBlocks is a free online drum machine and beat maker that runs in your web browser. You build a drum beat by dragging rhythmic values into a grid of beat blocks, one row per drum piece, then press play. There is no login, download, or install.",
  },
  {
    q: "Is RockBlocks free?",
    a: "Yes. Every feature — building beats, all the drum kits, TextyBeat, MP3 drum import, Stacks song arrangement, MP3 and MIDI export, saving to your own page, and the 100 Drum School lessons — is free, with no account required.",
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
    a: "Yes. You can set any bar length from 1 to 16 beats, so 3/4, 5/4, 7/8, and less common meters all work. This is one of the main reasons musicians use RockBlocks to sketch drum parts.",
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
    q: "Can I get the drums out of a song?",
    a: "You can upload an MP3 and RockBlocks will transcribe its drum track into an editable RockBlocks pattern that you can tweak, play, and export.",
  },
  {
    q: "Can I export or share my beat?",
    a: "Yes. Export any beat as an MP3 or a MIDI file, save it to a personal page at rockblocks.app/YourName, or share a pattern with a link.",
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
    q: "How is RockBlocks different from a step sequencer?",
    a: "A step sequencer gives you a fixed grid of on/off steps. RockBlocks gives you one block per beat and a palette of rhythm values — quarter notes, triplets, sixteenth runs — that you drag in, so one beat can hold any rhythm and a bar can be any length for odd time signatures.",
  },
  {
    q: "Is there a physical RockBlocks?",
    a: "A physical RockBlocks instrument for toy shops and music stores is planned. The web app is the same idea you can use today for free.",
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
