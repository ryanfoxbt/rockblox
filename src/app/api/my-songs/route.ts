import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSongs } from "@/db/schema";
import { EXTENDED_SLOT_LETTERS, SlotMap } from "@/lib/board";
import { RawSlotPayload, toSlotData } from "@/lib/slotPayload";
import { getCurrentUser } from "@/lib/auth/session";

function filledSlotCount(slots: SlotMap): number {
  return EXTENDED_SLOT_LETTERS.filter((l) => {
    const s = slots[l];
    return !!s && s.lines.length > 0;
  }).length;
}

// GET /api/my-songs — the signed-in user's private saved songs (newest edit
// first), trimmed to what the library list needs.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in for Super Powers" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select({ id: userSongs.id, title: userSongs.title, slots: userSongs.slots, updatedAt: userSongs.updatedAt })
    .from(userSongs)
    .where(eq(userSongs.ownerId, user.id))
    .orderBy(desc(userSongs.updatedAt));

  return NextResponse.json({
    songs: rows.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt,
      filledSlots: filledSlotCount(r.slots),
    })),
  });
}

// POST /api/my-songs — create a new song, optionally seeded with slots (e.g.
// "Save to my library" from the scratchpad or a read-only /songs page).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in for Super Powers" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { title?: unknown; slots?: Partial<Record<string, RawSlotPayload | null>> }
    | null;

  const title =
    body && typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "Untitled";

  const slots: SlotMap = {};
  if (body?.slots && typeof body.slots === "object") {
    for (const letter of EXTENDED_SLOT_LETTERS) {
      const raw = body.slots[letter];
      if (!raw || typeof raw !== "object") continue;
      const data = toSlotData(raw);
      if (data) slots[letter] = data;
    }
  }

  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(userSongs).values({ id, ownerId: user.id, title, slots });

  return NextResponse.json({ id, title }, { status: 201 });
}
