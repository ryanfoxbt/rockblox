// Keeps the graffiti wall (see WallButton.tsx) readable as scrawled-message
// chaos rather than link spam or slurs — light-touch on purpose, since the
// whole point of the wall is "anything goes." Two checks only: no links/HTML
// (the feature is short text, not a place to plant a URL) and a small
// hate-speech/slur blocklist. Everything else — profanity, nonsense, insults
// aimed at nobody in particular — is exactly the chaos this is for.
export const MAX_WALL_MESSAGE_LENGTH = 80;

// Deliberately short: severe slurs only, not everyday profanity. Matched as
// a substring against a letters-only lowercased version of the message, so
// spacing/punctuation tricks ("f-a-g") don't slip through, and so this list
// doesn't need to enumerate every casing/pluralization.
const BLOCKED_TERMS = [
  "nigger", "nigga", "faggot", "retard", "chink", "spic", "kike", "tranny",
  "raghead", "wetback", "gook", "coon", "beaner",
];

const URL_PATTERN = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|xyz|app|gg|me|link)\b/i;

// Returns the cleaned message, or null if it fails validation — callers
// treat null as "reject the post," not "sanitize and continue."
export function sanitizeWallMessage(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0 || trimmed.length > MAX_WALL_MESSAGE_LENGTH) return null;
  if (/[<>]/.test(trimmed)) return null;
  if (URL_PATTERN.test(trimmed)) return null;

  const lettersOnly = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED_TERMS.some((term) => lettersOnly.includes(term))) return null;

  return trimmed;
}
