import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { boardPresence } from "@/db/schema";
import { normalizeBoardSlug } from "@/lib/board";

// How long since a heartbeat before a visitor reads as "not here anymore" —
// well over the client's own ~20s heartbeat interval so one missed beat
// (a slow request, a backgrounded tab) doesn't flicker someone in and out.
const ACTIVE_WINDOW_SECONDS = 45;

const MAX_VISITOR_ID_LENGTH = 100;

// Vercel's own geo headers (production only — absent in local dev, and this
// degrades fine without them). Never the IP itself, and never anything more
// precise than a city/region string.
function coarseLocationFrom(request: NextRequest): string | null {
  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");
  const decodedCity = city ? decodeURIComponent(city) : null;
  if (decodedCity && region) return `${decodedCity}, ${region}`;
  if (decodedCity) return decodedCity;
  if (region && country) return `${region}, ${country}`;
  return country;
}

// A heartbeat: "I'm still here" from one open tab, upserted by (board,
// visitor). Responds with who else is currently active on this board — the
// same request doubles as both the write and the read, so a tab only needs
// one round trip per interval instead of two.
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const boardSlug = normalizeBoardSlug(slug);

  const body = (await request.json().catch(() => null)) as { visitorId?: unknown } | null;
  const visitorId = body && typeof body.visitorId === "string" ? body.visitorId.slice(0, MAX_VISITOR_ID_LENGTH) : "";
  if (!visitorId) {
    return NextResponse.json({ error: "Missing visitorId" }, { status: 400 });
  }

  const db = getDb();
  const location = coarseLocationFrom(request);

  await db
    .insert(boardPresence)
    .values({ boardSlug, visitorId, location, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [boardPresence.boardSlug, boardPresence.visitorId],
      set: { location, lastSeenAt: new Date() },
    });

  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_SECONDS * 1000);
  const others = await db
    .select({ location: boardPresence.location })
    .from(boardPresence)
    .where(
      and(
        eq(boardPresence.boardSlug, boardSlug),
        ne(boardPresence.visitorId, visitorId),
        gt(boardPresence.lastSeenAt, cutoff)
      )
    );

  // Best-effort cleanup of long-stale rows so the table doesn't grow
  // forever — piggybacked on a random ~2% of heartbeats rather than every
  // one (this is a low-stakes presence indicator, not worth a DELETE on
  // every request) or a separate cron job.
  if (Math.random() < 0.02) {
    await db.delete(boardPresence).where(sql`${boardPresence.lastSeenAt} < now() - interval '1 day'`);
  }

  return NextResponse.json({ others });
}
