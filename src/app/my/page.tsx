import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { userSongs } from "@/db/schema";
import { EXTENDED_SLOT_LETTERS } from "@/lib/board";
import { requireUser } from "@/lib/auth/session";
import { MySongsList } from "@/components/MySongsList";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Songs", robots: { index: false } };

export default async function MySongsPage() {
  const user = await requireUser();
  const db = getDb();
  const rows = await db
    .select({ id: userSongs.id, title: userSongs.title, slots: userSongs.slots, updatedAt: userSongs.updatedAt })
    .from(userSongs)
    .where(eq(userSongs.ownerId, user.id))
    .orderBy(desc(userSongs.updatedAt));

  const songs = rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    filledSlots: EXTENDED_SLOT_LETTERS.filter((l) => {
      const s = r.slots[l];
      return !!s && s.lines.length > 0;
    }).length,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          My <span className="text-yellow-400">Songs</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Your private saved drum songs — {user.name}. Each one has eight beat slots (A–H). Nobody
          else can see these.
        </p>
        <div className="mt-3 flex gap-4 text-xs">
          <Link href="/explore" className="text-yellow-400 transition hover:underline">
            Explore other pages →
          </Link>
          <Link href="/spy" className="text-yellow-400 transition hover:underline">
            Spy on activity →
          </Link>
        </div>
        <MySongsList initialSongs={songs} />
      </div>
    </div>
  );
}
