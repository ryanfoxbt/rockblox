import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { complaints } from "@/db/schema";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_URL_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { message?: unknown; url?: unknown }
    | null;

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Invalid complaint" }, { status: 400 });
  }
  if (!url || url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const db = getDb();
  await db.insert(complaints).values({ message, url });

  return NextResponse.json({ ok: true }, { status: 201 });
}
