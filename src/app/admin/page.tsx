import Link from "next/link";
import { getAdminAnalytics } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AdminDashboard } from "@/components/AdminDashboard";

export default async function AdminPage() {
  await requireAdmin();
  const data = await getAdminAnalytics();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          / <span className="text-white/60">Admin</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Analytics <span className="text-yellow-400">Dashboard</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">
              Real usage across RockBlocks — boards, saved songs, RockBlocks Math completions, and community
              activity — pulled straight from the database. Last updated on this page load.
            </p>
          </div>
          <Link
            href="/math/admin"
            className="mt-1 shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
          >
            Lesson editor →
          </Link>
        </div>

        <AdminDashboard data={data} />
      </div>
    </div>
  );
}
