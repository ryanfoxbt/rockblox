import { NextRequest, NextResponse } from "next/server";

// GET /api/rockwords/validate-word?word=cat — is this a real English word?
// Proxied server-side (rather than hit from the browser directly) so the
// third-party dependency and its own rate limits stay off the client, and
// so swapping providers later never needs a client-side change.
//
// Uses Datamuse's free, keyless spelling-match endpoint rather than a
// dictionary-definition API: dictionaryapi.dev (the more obvious choice)
// turned out to reliably time out — a Cloudflare 522, not a fast 404 — on
// every word it *doesn't* know, which is exactly the case this feature
// needs to detect quickly. Datamuse answers both "yes" and "no" cases in
// well under a second in testing. A word counts as real only if the
// response contains an *exact* (case-insensitive) match — `sp=` is a fuzzy
// spelling search, so a near-miss like "testword" comes back as a
// same-length neighbor ("westward") rather than nothing, and only an exact
// match should ever pass.
const DATAMUSE_API = "https://api.datamuse.com/words";

// In-memory only (resets on redeploy/restart) — this game's word lists are
// short and reused constantly, so even a small cache avoids hammering the
// third party for the same handful of words over and over. Capped so a
// stream of garbage guesses can't grow this unbounded for the life of the
// server process.
const cache = new Map<string, boolean>();
const CACHE_LIMIT = 5000;

async function looksLikeRealWord(word: string): Promise<boolean> {
  const cached = cache.get(word);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${DATAMUSE_API}?sp=${encodeURIComponent(word)}&max=1`, { signal: controller.signal });
    let valid = false;
    if (res.ok) {
      const results = (await res.json()) as { word?: string }[];
      valid = results.some((r) => r.word?.toLowerCase() === word);
    }
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(word, valid);
    return valid;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const word = (request.nextUrl.searchParams.get("word") ?? "").trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) {
    return NextResponse.json({ valid: false });
  }

  try {
    const valid = await looksLikeRealWord(word);
    return NextResponse.json({ valid });
  } catch {
    // A network hiccup or provider outage fails *open* (treated as valid)
    // rather than blocking a kid's guess over our own infrastructure being
    // flaky — this is a learning aid, not an anti-cheat gate, so the cost
    // of wrongly accepting a made-up word is much lower than the cost of
    // wrongly rejecting a real one a kid actually typed correctly.
    return NextResponse.json({ valid: true, uncertain: true });
  }
}
