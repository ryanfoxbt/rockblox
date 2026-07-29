const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function generateSlug(length = 8): string {
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return slug;
}
