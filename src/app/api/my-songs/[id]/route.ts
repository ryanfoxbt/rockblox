import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { userSongs } from "@/db/schema";
import { EXTENDED_SLOT_LETTERS, ExtendedSlotLetter } from "@/lib/board";
import { measureLengthFromStoredLines } from "@/lib/song";
import { isValidSingleSlotBody } from "@/lib/slotPayload";
import { isValidStackArrangement, MAX_STACK_SECONDS, totalStackSeconds } from "@/lib/stack";
import { slugifyTitle, slugSuffix } from "@/lib/publicSong";
import { getCurrentUser } from "@/lib/auth/session";

// Loads a song only if it belongs to the caller. Returns a discriminated
// result so handlers can map it straight to 401 / 404.
async function loadOwned(id: string) {
  const user = await getCurrentUser();
  if (!user) return { status: 401 as const };

  const db = getDb();
  const [song] = await db.select().from(userSongs).where(eq(userSongs.id, id)).limit(1);
  if (!song || song.ownerId !== user.id) return { status: 404 as const };

  return { status: 200 as const, user, song, db };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOwned(id);
  if (r.status !== 200) return NextResponse.json({ error: "Not found" }, { status: r.status });

  return NextResponse.json({
    id: r.song.id,
    title: r.song.title,
    slots: r.song.slots,
    stack: r.song.stack ?? null,
    isPublic: r.song.isPublic,
    publicSlug: r.song.publicSlug,
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOwned(id);
  if (r.status !== 200) return NextResponse.json({ error: "Not found" }, { status: r.status });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Rename.
  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 80) || "Untitled";
    await r.db.update(userSongs).set({ title, updatedAt: new Date() }).where(eq(userSongs.id, id));
    return NextResponse.json({ ok: true });
  }

  // Toggle public sharing. The first time it's enabled we mint a stable
  // `publicSlug` from the current title; later renames / unshare / re-share
  // never change it, so a link already posted somewhere keeps working. The
  // retry loop covers the (astronomically rare) suffix collision the unique
  // constraint would otherwise reject.
  if ("public" in body) {
    if (typeof body.public !== "boolean") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    let publicSlug = r.song.publicSlug;
    if (body.public && !publicSlug) {
      for (let attempt = 0; ; attempt++) {
        const candidate = `${slugifyTitle(r.song.title)}-${slugSuffix()}`;
        try {
          await r.db
            .update(userSongs)
            .set({ isPublic: true, publicSlug: candidate, updatedAt: new Date() })
            .where(eq(userSongs.id, id));
          publicSlug = candidate;
          break;
        } catch (err) {
          if (attempt >= 4) throw err;
        }
      }
    } else {
      await r.db
        .update(userSongs)
        .set({ isPublic: body.public, updatedAt: new Date() })
        .where(eq(userSongs.id, id));
    }
    return NextResponse.json({ ok: true, isPublic: body.public, publicSlug });
  }

  // Stack Builder arrangement over this song's A-H slots.
  if ("stack" in body) {
    if (!isValidStackArrangement(body.stack, EXTENDED_SLOT_LETTERS)) {
      return NextResponse.json({ error: "Invalid arrangement" }, { status: 400 });
    }
    const stack = body.stack ?? null;
    if (stack) {
      // Recompute against this song's *current* saved patterns — never trust
      // the client's duration math, and reject steps pointing at an empty slot
      // (mirrors the public board /stack route).
      const measureLengths: Partial<Record<ExtendedSlotLetter, number>> = {};
      for (const letter of EXTENDED_SLOT_LETTERS) {
        const slot = r.song.slots[letter];
        measureLengths[letter] = slot ? measureLengthFromStoredLines(slot.lines) : 0;
      }
      if (stack.steps.some((step) => (measureLengths[step.slot] ?? 0) < 1)) {
        return NextResponse.json({ error: "Can't add an empty beat to the song" }, { status: 400 });
      }
      if (totalStackSeconds(stack.steps, measureLengths, stack.bpm) > MAX_STACK_SECONDS) {
        return NextResponse.json({ error: "Song is over the 3:00 limit" }, { status: 400 });
      }
    }
    await r.db
      .update(userSongs)
      .set({ stack, updatedAt: new Date() })
      .where(eq(userSongs.id, id));
    return NextResponse.json({ ok: true });
  }

  // One-slot autosave — merged into the `slots` JSON so a write to slot E
  // never clobbers A-D.
  if (!isValidSingleSlotBody(body, EXTENDED_SLOT_LETTERS)) {
    return NextResponse.json({ error: "Invalid slot payload" }, { status: 400 });
  }
  const slotData = {
    bpm: body.bpm,
    lines: body.lines,
    kit: body.kit,
    customSamples: body.customSamples,
    bassline: body.bassline,
  };
  const patch = JSON.stringify({ [body.slot]: slotData });
  await r.db
    .update(userSongs)
    .set({ slots: sql`${userSongs.slots} || ${patch}::jsonb`, updatedAt: new Date() })
    .where(eq(userSongs.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in for Super Powers" }, { status: 401 });

  const db = getDb();
  await db.delete(userSongs).where(and(eq(userSongs.id, id), eq(userSongs.ownerId, user.id)));
  return NextResponse.json({ ok: true });
}
