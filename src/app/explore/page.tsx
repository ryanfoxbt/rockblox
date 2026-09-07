import { Suspense } from "react";
import { listBoardsForExplore } from "@/lib/boardList";
import { requireUser } from "@/lib/auth/session";
import { ExploreStarfield } from "@/components/ExploreStarfield";

export const dynamic = "force-dynamic";

export const metadata = { title: "Explore", robots: { index: false } };

export default async function ExplorePage() {
  await requireUser();
  const boards = await listBoardsForExplore();

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-slate-950" />}>
      <ExploreStarfield boards={boards} />
    </Suspense>
  );
}
