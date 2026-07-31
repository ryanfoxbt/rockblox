"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ClaimBoard({ name }: { name: string }) {
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    setStatus("creating");
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-center text-white">
      <h1 className="text-2xl font-black tracking-tight">
        Rock<span className="text-yellow-400">Blocks</span>
      </h1>
      <p className="max-w-sm text-white/70">
        <span className="font-mono text-yellow-400">/{name}</span> is available. Claim it as your own
        page to save up to 4 drum beats here — A, B, C, D.
      </p>
      <button
        type="button"
        onClick={handleCreate}
        disabled={status === "creating"}
        className="rounded-md border border-yellow-400 bg-yellow-400/10 px-5 py-2 font-medium text-yellow-400 transition hover:bg-yellow-400/20 disabled:opacity-50"
      >
        {status === "creating" ? "Claiming…" : `Claim /${name}`}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Link href="/" className="text-sm text-white/40 underline decoration-dotted hover:text-white/60">
        Back to RockBlocks
      </Link>
    </div>
  );
}
