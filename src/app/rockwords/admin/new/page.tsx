import Link from "next/link";
import { requireRockWordsAdmin } from "@/lib/auth/rockWordsAdmin";
import { RockWordsWordForm } from "@/components/RockWordsWordForm";

export default async function NewRockWordsWordPage() {
  await requireRockWordsAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/rockwords/admin" className="transition hover:text-yellow-400">
            RockWords Admin
          </Link>{" "}
          / <span className="text-white/60">New word</span>
        </nav>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          New <span className="text-yellow-400">Word</span>
        </h1>
        <RockWordsWordForm />
      </div>
    </div>
  );
}
