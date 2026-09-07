"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

// Header entry point for Super Powers. Signed out: a link to sign up. Signed
// in: the account name with a small menu (My Songs, Sign out). Rendered in the
// Editor header, so it shows on the scratchpad homepage and every board.
export function SuperPowersMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (isPending) return <div className="h-7 w-20" aria-hidden />;

  if (!session?.user) {
    return (
      <Link
        href="/auth/sign-up"
        className="shrink-0 rounded-full border border-yellow-400/60 px-3 py-1 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-400/10"
      >
        ⚡ Super Powers
      </Link>
    );
  }

  const label = session.user.name || session.user.email;

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut().catch(() => {});
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="max-w-[10rem] truncate rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
        title="Your account"
      >
        ⚡ {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-md border border-white/10 bg-slate-800 shadow-lg">
          <Link
            href="/explore"
            className="block px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
          >
            Explore
          </Link>
          <Link
            href="/spy"
            className="block px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
          >
            Spy
          </Link>
          <Link
            href="/my"
            className="block px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
          >
            My Songs
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
