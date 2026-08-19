import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { boards, wallMessages } from "@/db/schema";
import { normalizeBoardSlug } from "@/lib/board";
import { MAX_WALL_MESSAGE_LENGTH, sanitizeWallMessage } from "@/lib/wallModeration";

// Never stored or logged in the clear — only this hash, and only to enforce
// the per-board-per-IP cooldown below.
const IP_HASH_SALT = "rockblocks-wall-v1";

function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// How many most-recent lines the wall shows — a graffiti wall isn't an
// archive, and an unbounded list would make old, high-traffic boards slow to
// load for no benefit.
const MAX_WALL_MESSAGES = 200;

// One post per board per IP per cooldown — enough to stop a script from
// flooding a wall, loose enough that a real back-and-forth doesn't get
// throttled.
const POST_COOLDOWN_SECONDS = 20;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();

  const rows = await db
    .select({ id: wallMessages.id, message: wallMessages.message, createdAt: wallMessages.createdAt })
    .from(wallMessages)
    .where(eq(wallMessages.boardSlug, normalizeBoardSlug(slug)))
    .orderBy(desc(wallMessages.createdAt))
    .limit(MAX_WALL_MESSAGES);

  return NextResponse.json({ messages: rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const boardSlug = normalizeBoardSlug(slug);
  const db = getDb();

  const [board] = await db.select({ id: boards.id }).from(boards).where(eq(boards.slug, boardSlug)).limit(1);
  if (!board) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const raw = body && typeof body.message === "string" ? body.message : "";
  const message = sanitizeWallMessage(raw);
  if (!message) {
    return NextResponse.json(
      { error: `Keep it to ${MAX_WALL_MESSAGE_LENGTH} characters, no links, no HTML.` },
      { status: 400 }
    );
  }

  const ipHash = hashIp(clientIp(request));
  const cooldownStart = new Date(Date.now() - POST_COOLDOWN_SECONDS * 1000);
  const [recent] = await db
    .select({ id: wallMessages.id })
    .from(wallMessages)
    .where(
      and(eq(wallMessages.boardSlug, boardSlug), eq(wallMessages.ipHash, ipHash), gt(wallMessages.createdAt, cooldownStart))
    )
    .limit(1);
  if (recent) {
    return NextResponse.json({ error: "Slow down — one tag at a time." }, { status: 429 });
  }

  const [row] = await db
    .insert(wallMessages)
    .values({ boardSlug, message, ipHash })
    .returning({ id: wallMessages.id, message: wallMessages.message, createdAt: wallMessages.createdAt });

  return NextResponse.json({ message: row }, { status: 201 });
}
