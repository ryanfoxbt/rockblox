// One-off / re-runnable seed for RockWords (/rockwords) — a grade-tailored
// Wordle-style word game where every guess turns into part of a real
// RockBlocks beat (see src/lib/rockWordsBeat.ts). Deliberately safe, generic
// starter lists for Kindergarten (3 letters), Grade 1 (4 letters), and
// Grade 2 (5 letters) — everyday vocabulary a kid at that age already
// knows, no pop-culture references, since those are easy to get wrong
// secondhand. Add/edit those yourself through /rockwords/admin once you
// know the specifics you want.
import { getDb } from "../src/db";
import { rockWordsWords } from "../src/db/schema";

const db = getDb();

interface SeedWord {
  grade: number;
  word: string;
  clue: string;
  clueShownByDefault: boolean;
}

const KINDERGARTEN_WORDS: SeedWord[] = [
  { grade: 0, word: "cat", clue: "A furry pet that says meow.", clueShownByDefault: false },
  { grade: 0, word: "dog", clue: "A furry pet that says woof and loves to fetch.", clueShownByDefault: false },
  { grade: 0, word: "sun", clue: "The bright, hot ball in the sky during the day.", clueShownByDefault: false },
  { grade: 0, word: "hat", clue: "You wear this on your head.", clueShownByDefault: false },
  { grade: 0, word: "bus", clue: "A big yellow vehicle that takes kids to school.", clueShownByDefault: false },
  { grade: 0, word: "mom", clue: "A name for your mother.", clueShownByDefault: false },
  { grade: 0, word: "dad", clue: "A name for your father.", clueShownByDefault: false },
  { grade: 0, word: "pig", clue: "A pink farm animal that oinks and loves mud.", clueShownByDefault: false },
  { grade: 0, word: "cow", clue: "A farm animal that says moo and gives us milk.", clueShownByDefault: false },
  { grade: 0, word: "fox", clue: "A clever, orange animal with a bushy tail.", clueShownByDefault: false },
  { grade: 0, word: "cup", clue: "You drink water or juice out of this.", clueShownByDefault: false },
  { grade: 0, word: "bed", clue: "The furniture you sleep in at night.", clueShownByDefault: false },
  { grade: 0, word: "run", clue: "To move fast on your feet.", clueShownByDefault: false },
  { grade: 0, word: "bag", clue: "You carry your things in this.", clueShownByDefault: false },
  { grade: 0, word: "owl", clue: "A bird that says \"who\" and is awake at night.", clueShownByDefault: false },
  { grade: 0, word: "hen", clue: "A girl chicken that lays eggs.", clueShownByDefault: false },
  { grade: 0, word: "map", clue: "A picture that shows you where places are.", clueShownByDefault: false },
  { grade: 0, word: "van", clue: "A big vehicle, bigger than a car, that carries people or stuff.", clueShownByDefault: false },
  { grade: 0, word: "jar", clue: "A glass container with a lid, good for holding jam.", clueShownByDefault: false },
  { grade: 0, word: "box", clue: "A square container used for packing things.", clueShownByDefault: false },
  { grade: 0, word: "rug", clue: "A soft covering for the floor.", clueShownByDefault: false },
  { grade: 0, word: "bee", clue: "A buzzing insect that makes honey.", clueShownByDefault: false },
  { grade: 0, word: "toy", clue: "Something fun kids play with.", clueShownByDefault: false },
  { grade: 0, word: "sit", clue: "To rest your bottom on a chair or the floor.", clueShownByDefault: false },
  { grade: 0, word: "bat", clue: "A flying nighttime animal — or something you swing to hit a ball.", clueShownByDefault: false },
  { grade: 0, word: "hop", clue: "To jump on one or both feet, like a bunny.", clueShownByDefault: false },
  { grade: 0, word: "red", clue: "The color of a stop sign and strawberries.", clueShownByDefault: false },
  { grade: 0, word: "six", clue: "The number right after five.", clueShownByDefault: false },
  { grade: 0, word: "ten", clue: "The number right after nine — count your fingers!", clueShownByDefault: false },
  { grade: 0, word: "web", clue: "A sticky net a spider spins.", clueShownByDefault: false },
];

const GRADE_1_WORDS: SeedWord[] = [
  { grade: 1, word: "fish", clue: "An animal that swims and breathes underwater.", clueShownByDefault: false },
  { grade: 1, word: "frog", clue: "A jumping animal that starts life as a tadpole.", clueShownByDefault: false },
  { grade: 1, word: "star", clue: "A twinkling light you see in the night sky.", clueShownByDefault: false },
  { grade: 1, word: "moon", clue: "It circles the Earth and glows at night.", clueShownByDefault: false },
  { grade: 1, word: "bird", clue: "An animal with feathers and wings that can fly.", clueShownByDefault: false },
  { grade: 1, word: "tree", clue: "A tall plant with a trunk, branches, and leaves.", clueShownByDefault: false },
  { grade: 1, word: "book", clue: "You read the pages inside this.", clueShownByDefault: false },
  { grade: 1, word: "cake", clue: "A sweet treat you eat at a birthday party.", clueShownByDefault: false },
  { grade: 1, word: "milk", clue: "A white drink that comes from a cow.", clueShownByDefault: false },
  { grade: 1, word: "rain", clue: "Water that falls from clouds.", clueShownByDefault: false },
  { grade: 1, word: "snow", clue: "Cold, white flakes that fall in winter.", clueShownByDefault: false },
  { grade: 1, word: "jump", clue: "To push off the ground with your feet and rise in the air.", clueShownByDefault: false },
  { grade: 1, word: "swim", clue: "To move through water using your arms and legs.", clueShownByDefault: false },
  { grade: 1, word: "ball", clue: "A round toy you can bounce, throw, or kick.", clueShownByDefault: false },
  { grade: 1, word: "duck", clue: "A bird that swims in ponds and says quack.", clueShownByDefault: false },
  { grade: 1, word: "lion", clue: "A big wild cat known as the king of the jungle.", clueShownByDefault: false },
  { grade: 1, word: "bear", clue: "A big, furry animal that can climb trees and loves honey.", clueShownByDefault: false },
  { grade: 1, word: "wolf", clue: "A wild animal related to dogs that howls at night.", clueShownByDefault: false },
  { grade: 1, word: "cave", clue: "A hollow space inside a mountain or under the ground.", clueShownByDefault: false },
  { grade: 1, word: "gold", clue: "A shiny yellow metal that's very valuable.", clueShownByDefault: false },
  { grade: 1, word: "rock", clue: "A hard piece of stone.", clueShownByDefault: false },
  { grade: 1, word: "sand", clue: "Tiny grains you find at the beach.", clueShownByDefault: false },
  { grade: 1, word: "wind", clue: "Moving air you can feel but not see.", clueShownByDefault: false },
  { grade: 1, word: "fire", clue: "Hot, bright flames that give off light and heat.", clueShownByDefault: false },
  { grade: 1, word: "leaf", clue: "A flat green part of a plant that grows on branches.", clueShownByDefault: false },
  { grade: 1, word: "nest", clue: "A bird builds this to lay its eggs in.", clueShownByDefault: false },
  { grade: 1, word: "barn", clue: "A big building on a farm where animals live.", clueShownByDefault: false },
  { grade: 1, word: "corn", clue: "A yellow vegetable that grows on a tall stalk.", clueShownByDefault: false },
  { grade: 1, word: "farm", clue: "A place where crops are grown and animals are raised.", clueShownByDefault: false },
  { grade: 1, word: "pond", clue: "A small body of still water.", clueShownByDefault: false },
];

const GRADE_2_WORDS: SeedWord[] = [
  { grade: 2, word: "apple", clue: "A crunchy fruit that can be red, green, or yellow.", clueShownByDefault: false },
  { grade: 2, word: "beach", clue: "A sandy place next to the ocean.", clueShownByDefault: false },
  { grade: 2, word: "bread", clue: "A food made from baked dough, often sliced for sandwiches.", clueShownByDefault: false },
  { grade: 2, word: "brave", clue: "Not afraid to do something hard or scary.", clueShownByDefault: false },
  { grade: 2, word: "chair", clue: "A piece of furniture you sit on.", clueShownByDefault: false },
  { grade: 2, word: "cloud", clue: "A white or gray shape floating in the sky, made of tiny water drops.", clueShownByDefault: false },
  { grade: 2, word: "dance", clue: "To move your body to music.", clueShownByDefault: false },
  { grade: 2, word: "eagle", clue: "A large bird of prey with sharp eyesight.", clueShownByDefault: false },
  { grade: 2, word: "earth", clue: "The planet we live on.", clueShownByDefault: false },
  { grade: 2, word: "flame", clue: "The glowing, hot part of a fire.", clueShownByDefault: false },
  { grade: 2, word: "floor", clue: "The part of a room you walk on.", clueShownByDefault: false },
  { grade: 2, word: "flute", clue: "A thin musical instrument you blow across to play.", clueShownByDefault: false },
  { grade: 2, word: "giant", clue: "Something (or someone) much bigger than normal.", clueShownByDefault: false },
  { grade: 2, word: "grape", clue: "A small, round fruit that grows in bunches.", clueShownByDefault: false },
  { grade: 2, word: "heart", clue: "The organ in your chest that pumps blood.", clueShownByDefault: false },
  { grade: 2, word: "horse", clue: "A large animal people ride, with hooves and a mane.", clueShownByDefault: false },
  { grade: 2, word: "house", clue: "A building where people live.", clueShownByDefault: false },
  { grade: 2, word: "lemon", clue: "A sour yellow fruit.", clueShownByDefault: false },
  { grade: 2, word: "light", clue: "What lets you see in the dark once it's turned on.", clueShownByDefault: false },
  { grade: 2, word: "mouse", clue: "A small furry rodent — or the thing you click with on a computer.", clueShownByDefault: false },
  { grade: 2, word: "music", clue: "Sounds made with rhythm and melody, like a song.", clueShownByDefault: false },
  { grade: 2, word: "ocean", clue: "A huge body of salt water.", clueShownByDefault: false },
  { grade: 2, word: "paint", clue: "Colorful liquid you use to make art.", clueShownByDefault: false },
  { grade: 2, word: "plant", clue: "A living thing that grows from the ground, like a flower or tree.", clueShownByDefault: false },
  { grade: 2, word: "river", clue: "A large stream of water that flows to the sea.", clueShownByDefault: false },
  { grade: 2, word: "shark", clue: "A big fish with sharp teeth that lives in the ocean.", clueShownByDefault: false },
  { grade: 2, word: "sheep", clue: "A woolly farm animal that says baa.", clueShownByDefault: false },
  { grade: 2, word: "smile", clue: "What your face does when you're happy.", clueShownByDefault: false },
  { grade: 2, word: "storm", clue: "Wild weather with wind, rain, and sometimes thunder.", clueShownByDefault: false },
  { grade: 2, word: "tiger", clue: "A big wild cat with orange and black stripes.", clueShownByDefault: false },
];

const ALL_WORDS: SeedWord[] = [...KINDERGARTEN_WORDS, ...GRADE_1_WORDS, ...GRADE_2_WORDS];

// Pre-launch, re-runnable content (no user data references it yet) — clear
// and reseed rather than trying to reconcile in place, same convention as
// seedMathLessons.mts.
await db.delete(rockWordsWords);

for (const w of ALL_WORDS) {
  await db
    .insert(rockWordsWords)
    .values({ grade: w.grade, word: w.word, clue: w.clue, clueShownByDefault: w.clueShownByDefault, isPublished: true })
    .onConflictDoUpdate({
      target: [rockWordsWords.grade, rockWordsWords.word],
      set: { clue: w.clue, clueShownByDefault: w.clueShownByDefault, isPublished: true },
    });
  console.log(`Seeded RockWords "${w.word}" (grade ${w.grade})`);
}

console.log(`Done — seeded ${ALL_WORDS.length} RockWords words.`);
