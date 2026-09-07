import Link from "next/link";
import { getActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth/session";
import { SpyFeed } from "@/components/SpyFeed";

export const dynamic = "force-dynamic";

export const metadata = { title: "Spy", robots: { index: false } };

export default async function SpyPage() {
  await requireUser();
  const initial = await getActivity();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          <span className="text-yellow-400">Spy</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Live look at every public RockBlocks page — who&apos;s on one right now, what just got
          edited, what people are scrawling on the walls. Tap any row to peek and copy a beat.
        </p>
        <SpyFeed initial={initial} />
      </div>
    </div>
  );
}
