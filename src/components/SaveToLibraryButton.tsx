"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EXTENDED_SLOT_LETTERS, SlotMap } from "@/lib/board";
import { authClient } from "@/lib/auth/client";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";

// Save whatever's on screen to a brand-new private song in the signed-in
// user's library (Super Powers). Sibling of SaveCopyButton, which saves to a
// public /Name board instead. Renders nothing for signed-out visitors.
export function SaveToLibraryButton({
  getSlots,
  variant = "button",
}: {
  getSlots: () => SlotMap;
  variant?: "button" | "menuItem";
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session?.user) return null;

  function close() {
    setOpen(false);
    setTitle("");
    setSaving(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const slots = getSlots();
    const slotsPayload = Object.fromEntries(
      EXTENDED_SLOT_LETTERS.filter((l) => slots[l] && slots[l]!.lines.length > 0).map((l) => [l, slots[l]])
    );

    try {
      const res = await fetch("/api/my-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Untitled", slots: slotsPayload }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !data?.id) {
        setError(data?.error ?? "Couldn't save");
        setSaving(false);
        return;
      }
      router.push(`/my/${data.id}`);
    } catch {
      setError("Couldn't save");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Save this to your private library"
        className={
          variant === "menuItem"
            ? "block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
            : "rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
        }
      >
        ⚡ Save to my library
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-sm rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Save to my library</h2>
              <button
                type="button"
                onClick={close}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-white/50">
              Saves whatever&apos;s on screen to a new private song only you can see. It won&apos;t touch
              any public page.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                {...NO_PASSWORD_MANAGER_ATTRS}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                placeholder="Song name"
                maxLength={80}
                className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="mt-1 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
