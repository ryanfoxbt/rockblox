// One-off / re-runnable seed for RockWords (/rockwords) — a grade-tailored
// Wordle-style word game where every guess turns into part of a real
// RockBlocks beat (see src/lib/rockWordsBeat.ts). Deliberately safe, generic
// word lists covering Kindergarten through Grade 12, one word length per
// grade (see RW_GRADES in src/lib/rockWords.ts) — everyday vocabulary for
// the early grades, shifting to dictionary/thesaurus-style words and clues
// for middle and high school. No pop-culture references anywhere, since
// those are easy to get wrong secondhand. Add/edit through /rockwords/admin
// once you know the specifics you want.
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

const GRADE_3_WORDS: SeedWord[] = [
  { grade: 3, word: "forest", clue: "A large area covered with trees.", clueShownByDefault: false },
  { grade: 3, word: "planet", clue: "A large round body that orbits a star, like Earth orbits the sun.", clueShownByDefault: false },
  { grade: 3, word: "pencil", clue: "A tool used for writing or drawing with graphite.", clueShownByDefault: false },
  { grade: 3, word: "spider", clue: "A small eight-legged creature that spins webs.", clueShownByDefault: false },
  { grade: 3, word: "rocket", clue: "A vehicle that blasts off to travel into space.", clueShownByDefault: false },
  { grade: 3, word: "desert", clue: "A dry, sandy area that gets very little rain.", clueShownByDefault: false },
  { grade: 3, word: "bridge", clue: "A structure built to cross a river or valley.", clueShownByDefault: false },
  { grade: 3, word: "castle", clue: "A large stone building with towers, built long ago for protection.", clueShownByDefault: false },
  { grade: 3, word: "dragon", clue: "A mythical creature often shown breathing fire.", clueShownByDefault: false },
  { grade: 3, word: "window", clue: "An opening in a wall covered with glass to let in light.", clueShownByDefault: false },
  { grade: 3, word: "garden", clue: "A piece of land used for growing flowers or vegetables.", clueShownByDefault: false },
  { grade: 3, word: "hunter", clue: "A person who tracks and catches wild animals.", clueShownByDefault: false },
  { grade: 3, word: "island", clue: "A piece of land completely surrounded by water.", clueShownByDefault: false },
  { grade: 3, word: "jungle", clue: "A thick, tangled forest found in hot, wet places.", clueShownByDefault: false },
  { grade: 3, word: "kitten", clue: "A baby cat.", clueShownByDefault: false },
  { grade: 3, word: "ladder", clue: "A set of steps used for climbing up or down.", clueShownByDefault: false },
  { grade: 3, word: "magnet", clue: "An object that pulls certain metals toward it.", clueShownByDefault: false },
  { grade: 3, word: "monkey", clue: "A playful animal that lives in trees and has a tail.", clueShownByDefault: false },
  { grade: 3, word: "needle", clue: "A thin, pointed tool used for sewing.", clueShownByDefault: false },
  { grade: 3, word: "orange", clue: "A round citrus fruit with a bright peel.", clueShownByDefault: false },
];

const GRADE_4_WORDS: SeedWord[] = [
  { grade: 4, word: "rainbow", clue: "An arc of colors that appears in the sky after rain.", clueShownByDefault: false },
  { grade: 4, word: "dolphin", clue: "A smart, playful sea mammal known for its clicking sounds.", clueShownByDefault: false },
  { grade: 4, word: "volcano", clue: "A mountain that can erupt with hot, melted rock.", clueShownByDefault: false },
  { grade: 4, word: "thunder", clue: "The loud rumbling sound that follows lightning.", clueShownByDefault: false },
  { grade: 4, word: "journey", clue: "A long trip from one place to another.", clueShownByDefault: false },
  { grade: 4, word: "glacier", clue: "A huge, slow-moving mass of ice.", clueShownByDefault: false },
  { grade: 4, word: "gravity", clue: "The force that pulls objects toward the Earth.", clueShownByDefault: false },
  { grade: 4, word: "crystal", clue: "A clear, hard mineral formation with flat sides.", clueShownByDefault: false },
  { grade: 4, word: "penguin", clue: "A flightless bird that swims well and lives in cold places.", clueShownByDefault: false },
  { grade: 4, word: "teacher", clue: "A person whose job is to help students learn.", clueShownByDefault: false },
  { grade: 4, word: "capital", clue: "The city where a country's or state's government is based.", clueShownByDefault: false },
  { grade: 4, word: "compass", clue: "A tool with a needle that always points north.", clueShownByDefault: false },
  { grade: 4, word: "harvest", clue: "Gathering crops that are ready to be picked.", clueShownByDefault: false },
  { grade: 4, word: "picture", clue: "An image, drawing, or photograph.", clueShownByDefault: false },
  { grade: 4, word: "seventy", clue: "The number equal to seven tens.", clueShownByDefault: false },
  { grade: 4, word: "surface", clue: "The outer or top layer of something.", clueShownByDefault: false },
  { grade: 4, word: "tornado", clue: "A violently spinning column of air that touches the ground.", clueShownByDefault: false },
  { grade: 4, word: "weekend", clue: "Saturday and Sunday, the days off from school.", clueShownByDefault: false },
  { grade: 4, word: "chimney", clue: "A pipe that lets smoke rise out of a house.", clueShownByDefault: false },
  { grade: 4, word: "lantern", clue: "A portable light, often carried by a handle.", clueShownByDefault: false },
];

const GRADE_5_WORDS: SeedWord[] = [
  { grade: 5, word: "climate", clue: "The usual weather pattern of a region over a long time.", clueShownByDefault: false },
  { grade: 5, word: "current", clue: "A flow of water, air, or electricity in one direction.", clueShownByDefault: false },
  { grade: 5, word: "extinct", clue: "No longer existing anywhere on Earth.", clueShownByDefault: false },
  { grade: 5, word: "analyze", clue: "To study something carefully in order to understand it.", clueShownByDefault: false },
  { grade: 5, word: "average", clue: "A typical amount, found by adding numbers and dividing.", clueShownByDefault: false },
  { grade: 5, word: "balance", clue: "A state of steadiness where things are evenly weighted.", clueShownByDefault: false },
  { grade: 5, word: "century", clue: "A period of one hundred years.", clueShownByDefault: false },
  { grade: 5, word: "chemist", clue: "A scientist who studies matter and how substances react.", clueShownByDefault: false },
  { grade: 5, word: "concept", clue: "A general idea or understanding of something.", clueShownByDefault: false },
  { grade: 5, word: "destiny", clue: "The events that will necessarily happen to someone in the future.", clueShownByDefault: false },
  { grade: 5, word: "economy", clue: "The system of trade and money in a country.", clueShownByDefault: false },
  { grade: 5, word: "explore", clue: "To travel through a place in order to learn what's there.", clueShownByDefault: false },
  { grade: 5, word: "justice", clue: "Fairness in the way people are treated.", clueShownByDefault: false },
  { grade: 5, word: "liberty", clue: "Freedom from control or oppression.", clueShownByDefault: false },
  { grade: 5, word: "migrate", clue: "To move from one region to another, often with the seasons.", clueShownByDefault: false },
  { grade: 5, word: "nucleus", clue: "The central part of a cell or an atom.", clueShownByDefault: false },
  { grade: 5, word: "predict", clue: "To say what will happen before it does.", clueShownByDefault: false },
  { grade: 5, word: "reptile", clue: "A cold-blooded animal such as a snake or lizard.", clueShownByDefault: false },
  { grade: 5, word: "species", clue: "A group of living things that can breed with one another.", clueShownByDefault: false },
  { grade: 5, word: "texture", clue: "The way a surface feels, such as rough or smooth.", clueShownByDefault: false },
];

const GRADE_6_WORDS: SeedWord[] = [
  { grade: 6, word: "dinosaur", clue: "A prehistoric reptile that lived millions of years ago.", clueShownByDefault: false },
  { grade: 6, word: "molecule", clue: "The smallest unit of a substance that keeps its properties.", clueShownByDefault: false },
  { grade: 6, word: "skeleton", clue: "The framework of bones that supports a body.", clueShownByDefault: false },
  { grade: 6, word: "mountain", clue: "A very high, steep landform rising above the surrounding land.", clueShownByDefault: false },
  { grade: 6, word: "sentence", clue: "A group of words that expresses a complete thought.", clueShownByDefault: false },
  { grade: 6, word: "triangle", clue: "A shape with three sides and three angles.", clueShownByDefault: false },
  { grade: 6, word: "hospital", clue: "A place where sick or injured people are treated.", clueShownByDefault: false },
  { grade: 6, word: "computer", clue: "An electronic device that processes information.", clueShownByDefault: false },
  { grade: 6, word: "calendar", clue: "A chart that shows the days, weeks, and months of a year.", clueShownByDefault: false },
  { grade: 6, word: "dictator", clue: "A ruler who holds total power over a country.", clueShownByDefault: false },
  { grade: 6, word: "republic", clue: "A form of government where citizens elect their leaders.", clueShownByDefault: false },
  { grade: 6, word: "colonial", clue: "Relating to a colony, or to the period when colonies existed.", clueShownByDefault: false },
  { grade: 6, word: "explorer", clue: "A person who travels to discover new places.", clueShownByDefault: false },
  { grade: 6, word: "flagpole", clue: "A pole used to fly a flag.", clueShownByDefault: false },
  { grade: 6, word: "gemstone", clue: "A mineral or stone valued for its beauty, used in jewelry.", clueShownByDefault: false },
  { grade: 6, word: "handbook", clue: "A small book giving useful information on a topic.", clueShownByDefault: false },
  { grade: 6, word: "keyboard", clue: "A set of keys used to type on a computer or play music.", clueShownByDefault: false },
  { grade: 6, word: "landform", clue: "A natural feature of the Earth's surface, like a mountain or valley.", clueShownByDefault: false },
  { grade: 6, word: "medieval", clue: "Relating to the Middle Ages, a period of European history.", clueShownByDefault: false },
  { grade: 6, word: "volcanic", clue: "Relating to, or produced by, a volcano.", clueShownByDefault: false },
];

const GRADE_7_WORDS: SeedWord[] = [
  { grade: 7, word: "abstract", clue: "Existing as an idea rather than a physical thing.", clueShownByDefault: false },
  { grade: 7, word: "adequate", clue: "Enough for a particular purpose.", clueShownByDefault: false },
  { grade: 7, word: "ancestor", clue: "A person from whom one is descended, earlier than a grandparent.", clueShownByDefault: false },
  { grade: 7, word: "boundary", clue: "A line that marks the limit of an area.", clueShownByDefault: false },
  { grade: 7, word: "campaign", clue: "A series of actions planned to achieve a particular goal.", clueShownByDefault: false },
  { grade: 7, word: "category", clue: "A group of things sharing common characteristics.", clueShownByDefault: false },
  { grade: 7, word: "conflict", clue: "A serious disagreement or clash.", clueShownByDefault: false },
  { grade: 7, word: "document", clue: "A written or printed piece of information.", clueShownByDefault: false },
  { grade: 7, word: "dominant", clue: "Most powerful or influential.", clueShownByDefault: false },
  { grade: 7, word: "envelope", clue: "A flat paper covering used to mail a letter.", clueShownByDefault: false },
  { grade: 7, word: "evidence", clue: "Facts or signs that show something is true.", clueShownByDefault: false },
  { grade: 7, word: "function", clue: "The special purpose or role of something.", clueShownByDefault: false },
  { grade: 7, word: "gradient", clue: "A gradual change in slope, color, or amount.", clueShownByDefault: false },
  { grade: 7, word: "hardship", clue: "A condition involving difficulty or suffering.", clueShownByDefault: false },
  { grade: 7, word: "identity", clue: "Who or what a person or thing is.", clueShownByDefault: false },
  { grade: 7, word: "juvenile", clue: "Relating to young people; not yet an adult.", clueShownByDefault: false },
  { grade: 7, word: "landmark", clue: "A notable or easily seen feature of a landscape.", clueShownByDefault: false },
  { grade: 7, word: "minority", clue: "A smaller part of a larger group.", clueShownByDefault: false },
  { grade: 7, word: "negative", clue: "Expressing denial or refusal, or the opposite of positive.", clueShownByDefault: false },
  { grade: 7, word: "official", clue: "Relating to a position of authority; authorized.", clueShownByDefault: false },
];

const GRADE_8_WORDS: SeedWord[] = [
  { grade: 8, word: "ambiguous", clue: "Open to more than one interpretation.", clueShownByDefault: false },
  { grade: 8, word: "brilliant", clue: "Exceptionally clever, talented, or impressive.", clueShownByDefault: false },
  { grade: 8, word: "candidate", clue: "A person who applies for a job or runs for office.", clueShownByDefault: false },
  { grade: 8, word: "condition", clue: "The state something is in, or a requirement that must be met.", clueShownByDefault: false },
  { grade: 8, word: "developed", clue: "Having advanced industry and infrastructure.", clueShownByDefault: false },
  { grade: 8, word: "discourse", clue: "Written or spoken communication about a topic.", clueShownByDefault: false },
  { grade: 8, word: "education", clue: "The process of teaching or learning.", clueShownByDefault: false },
  { grade: 8, word: "elaborate", clue: "Detailed and complicated in design.", clueShownByDefault: false },
  { grade: 8, word: "essential", clue: "Absolutely necessary.", clueShownByDefault: false },
  { grade: 8, word: "framework", clue: "A basic structure underlying a system or concept.", clueShownByDefault: false },
  { grade: 8, word: "guarantee", clue: "A firm promise that something will happen.", clueShownByDefault: false },
  { grade: 8, word: "hierarchy", clue: "A system that ranks people or things by level of importance.", clueShownByDefault: false },
  { grade: 8, word: "immigrant", clue: "A person who moves to a new country to live there.", clueShownByDefault: false },
  { grade: 8, word: "influence", clue: "The power to affect someone's actions or thinking.", clueShownByDefault: false },
  { grade: 8, word: "integrity", clue: "The quality of being honest and having strong moral principles.", clueShownByDefault: false },
  { grade: 8, word: "narrative", clue: "A spoken or written account of connected events; a story.", clueShownByDefault: false },
  { grade: 8, word: "objective", clue: "A goal one is trying to achieve, or based on fact rather than feeling.", clueShownByDefault: false },
  { grade: 8, word: "principle", clue: "A fundamental rule or belief that guides behavior.", clueShownByDefault: false },
  { grade: 8, word: "transform", clue: "To change completely in form or appearance.", clueShownByDefault: false },
  { grade: 8, word: "structure", clue: "The way parts of something are organized or built.", clueShownByDefault: false },
];

const GRADE_9_WORDS: SeedWord[] = [
  { grade: 9, word: "adversity", clue: "Difficulty or hardship.", clueShownByDefault: false },
  { grade: 9, word: "arbitrary", clue: "Based on random choice rather than reason.", clueShownByDefault: false },
  { grade: 9, word: "consensus", clue: "General agreement among a group.", clueShownByDefault: false },
  { grade: 9, word: "criterion", clue: "A standard used to judge or decide something.", clueShownByDefault: false },
  { grade: 9, word: "deviation", clue: "A departure from the usual or expected course.", clueShownByDefault: false },
  { grade: 9, word: "eloquence", clue: "Fluent and persuasive speaking or writing.", clueShownByDefault: false },
  { grade: 9, word: "empirical", clue: "Based on observation or experiment rather than theory.", clueShownByDefault: false },
  { grade: 9, word: "fluctuate", clue: "To rise and fall irregularly.", clueShownByDefault: false },
  { grade: 9, word: "hypocrisy", clue: "Claiming to have beliefs one does not actually act on.", clueShownByDefault: false },
  { grade: 9, word: "inference", clue: "A conclusion reached through reasoning from evidence.", clueShownByDefault: false },
  { grade: 9, word: "ludicrous", clue: "So unreasonable as to be funny.", clueShownByDefault: false },
  { grade: 9, word: "nostalgia", clue: "A sentimental longing for the past.", clueShownByDefault: false },
  { grade: 9, word: "oblivious", clue: "Not aware of what's happening around you.", clueShownByDefault: false },
  { grade: 9, word: "plausible", clue: "Seeming reasonable or probable.", clueShownByDefault: false },
  { grade: 9, word: "prejudice", clue: "An unfair opinion formed without enough knowledge.", clueShownByDefault: false },
  { grade: 9, word: "resilient", clue: "Able to recover quickly from difficulty.", clueShownByDefault: false },
  { grade: 9, word: "skeptical", clue: "Having doubts; not easily convinced.", clueShownByDefault: false },
  { grade: 9, word: "tentative", clue: "Not certain or fixed; provisional.", clueShownByDefault: false },
  { grade: 9, word: "vindicate", clue: "To clear someone of blame after being proven right.", clueShownByDefault: false },
  { grade: 9, word: "arbitrate", clue: "To settle a dispute between two parties.", clueShownByDefault: false },
];

const GRADE_10_WORDS: SeedWord[] = [
  { grade: 10, word: "accomplish", clue: "To succeed in doing something.", clueShownByDefault: false },
  { grade: 10, word: "adaptation", clue: "The process of changing to suit new conditions.", clueShownByDefault: false },
  { grade: 10, word: "ambivalent", clue: "Having mixed feelings about something.", clueShownByDefault: false },
  { grade: 10, word: "compromise", clue: "An agreement reached by each side giving up something.", clueShownByDefault: false },
  { grade: 10, word: "discipline", clue: "Training that develops self-control, or a field of study.", clueShownByDefault: false },
  { grade: 10, word: "impressive", clue: "Making a strong, positive impact.", clueShownByDefault: false },
  { grade: 10, word: "legitimate", clue: "Conforming to the law or accepted standards.", clueShownByDefault: false },
  { grade: 10, word: "optimistic", clue: "Hopeful and confident about the future.", clueShownByDefault: false },
  { grade: 10, word: "persistent", clue: "Continuing firmly despite difficulty.", clueShownByDefault: false },
  { grade: 10, word: "proportion", clue: "A part considered in relation to the whole.", clueShownByDefault: false },
  { grade: 10, word: "resolution", clue: "A firm decision to do or not do something.", clueShownByDefault: false },
  { grade: 10, word: "skepticism", clue: "An attitude of doubt or questioning.", clueShownByDefault: false },
  { grade: 10, word: "strategist", clue: "A person skilled in planning to achieve a goal.", clueShownByDefault: false },
  { grade: 10, word: "subjective", clue: "Based on personal feelings rather than facts.", clueShownByDefault: false },
  { grade: 10, word: "sustenance", clue: "Food and drink needed to stay alive.", clueShownByDefault: false },
  { grade: 10, word: "transition", clue: "The process of changing from one state to another.", clueShownByDefault: false },
  { grade: 10, word: "adventurer", clue: "A person who seeks new and exciting experiences.", clueShownByDefault: false },
  { grade: 10, word: "articulate", clue: "Able to express ideas clearly and effectively.", clueShownByDefault: false },
  { grade: 10, word: "deliberate", clue: "Done consciously and intentionally.", clueShownByDefault: false },
  { grade: 10, word: "hemisphere", clue: "One half of the Earth, often divided north-south or east-west.", clueShownByDefault: false },
];

const GRADE_11_WORDS: SeedWord[] = [
  { grade: 11, word: "antagonist", clue: "A person who opposes the main character; an adversary.", clueShownByDefault: false },
  { grade: 11, word: "autonomous", clue: "Self-governing; acting independently.", clueShownByDefault: false },
  { grade: 11, word: "benevolent", clue: "Kind and generous.", clueShownByDefault: false },
  { grade: 11, word: "camouflage", clue: "A disguise that blends with the surroundings.", clueShownByDefault: false },
  { grade: 11, word: "compelling", clue: "Evoking strong interest or attention.", clueShownByDefault: false },
  { grade: 11, word: "depreciate", clue: "To lose value over time.", clueShownByDefault: false },
  { grade: 11, word: "equivalent", clue: "Equal in value, meaning, or importance.", clueShownByDefault: false },
  { grade: 11, word: "eradicated", clue: "Completely destroyed or gotten rid of.", clueShownByDefault: false },
  { grade: 11, word: "exuberance", clue: "The quality of being full of energy and enthusiasm.", clueShownByDefault: false },
  { grade: 11, word: "formidable", clue: "Inspiring fear or respect through being impressively large or capable.", clueShownByDefault: false },
  { grade: 11, word: "hypothesis", clue: "An idea proposed as a starting point for further investigation.", clueShownByDefault: false },
  { grade: 11, word: "incoherent", clue: "Not logical or consistent; unclear.", clueShownByDefault: false },
  { grade: 11, word: "indigenous", clue: "Originating naturally in a particular place.", clueShownByDefault: false },
  { grade: 11, word: "malevolent", clue: "Having or showing a wish to do harm to others.", clueShownByDefault: false },
  { grade: 11, word: "meticulous", clue: "Showing great attention to detail; very careful.", clueShownByDefault: false },
  { grade: 11, word: "peripheral", clue: "Relating to the outer edge; of secondary importance.", clueShownByDefault: false },
  { grade: 11, word: "relentless", clue: "Oppressively constant; not stopping.", clueShownByDefault: false },
  { grade: 11, word: "reluctance", clue: "Unwillingness to do something.", clueShownByDefault: false },
  { grade: 11, word: "tumultuous", clue: "Marked by disorder or confusion.", clueShownByDefault: false },
  { grade: 11, word: "vulnerable", clue: "Capable of being easily hurt or harmed.", clueShownByDefault: false },
];

const GRADE_12_WORDS: SeedWord[] = [
  { grade: 12, word: "approximate", clue: "Close to the actual value, but not exact.", clueShownByDefault: false },
  { grade: 12, word: "belligerent", clue: "Hostile and aggressive.", clueShownByDefault: false },
  { grade: 12, word: "bureaucracy", clue: "A system of government run by many officials and departments.", clueShownByDefault: false },
  { grade: 12, word: "circumspect", clue: "Careful to consider all consequences before acting.", clueShownByDefault: false },
  { grade: 12, word: "controversy", clue: "Public disagreement or debate.", clueShownByDefault: false },
  { grade: 12, word: "deteriorate", clue: "To become progressively worse.", clueShownByDefault: false },
  { grade: 12, word: "discrepancy", clue: "A difference between things that should be the same.", clueShownByDefault: false },
  { grade: 12, word: "exaggerated", clue: "Made to seem larger or greater than it really is.", clueShownByDefault: false },
  { grade: 12, word: "hospitality", clue: "The friendly welcoming and treatment of guests or strangers.", clueShownByDefault: false },
  { grade: 12, word: "illustrious", clue: "Well known, respected, and admired for past achievements.", clueShownByDefault: false },
  { grade: 12, word: "incompetent", clue: "Not having the skill to do something successfully.", clueShownByDefault: false },
  { grade: 12, word: "independent", clue: "Free from outside control; not depending on another.", clueShownByDefault: false },
  { grade: 12, word: "observatory", clue: "A building equipped for observing astronomical events.", clueShownByDefault: false },
  { grade: 12, word: "philosopher", clue: "A person who studies fundamental questions about existence and knowledge.", clueShownByDefault: false },
  { grade: 12, word: "resourceful", clue: "Able to find quick and clever ways to solve problems.", clueShownByDefault: false },
  { grade: 12, word: "subordinate", clue: "Lower in rank or position.", clueShownByDefault: false },
  { grade: 12, word: "superficial", clue: "Concerned only with the obvious; not deep or thorough.", clueShownByDefault: false },
  { grade: 12, word: "transparent", clue: "Easy to see through, or open and honest.", clueShownByDefault: false },
  { grade: 12, word: "unconscious", clue: "Not aware; not conscious.", clueShownByDefault: false },
  { grade: 12, word: "temperament", clue: "A person's nature, especially as it affects behavior.", clueShownByDefault: false },
];

const ALL_WORDS: SeedWord[] = [
  ...KINDERGARTEN_WORDS,
  ...GRADE_1_WORDS,
  ...GRADE_2_WORDS,
  ...GRADE_3_WORDS,
  ...GRADE_4_WORDS,
  ...GRADE_5_WORDS,
  ...GRADE_6_WORDS,
  ...GRADE_7_WORDS,
  ...GRADE_8_WORDS,
  ...GRADE_9_WORDS,
  ...GRADE_10_WORDS,
  ...GRADE_11_WORDS,
  ...GRADE_12_WORDS,
];

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
