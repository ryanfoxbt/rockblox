"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BoardSlotData, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { StackArrangement } from "@/lib/stack";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";

// Lets someone mess around on a read-only /songs or /school page and, if
// they land on something they like, save it to a brand-new page of their
// own — without ever touching the original song/lesson (which never
// autosaves in the first place — see BoardData.readOnly). Two-step save:
// POST /api/boards with every non-empty slot, then (if there's a Stack
// arrangement to carry over) PUT its /stack — same two calls a person would
// make by hand via ClaimUrlBox + Stack Builder, just bundled into one click.
export function SaveCopyButton({
  getSlots,
  getStack,
  variant = "menuItem",
}: {
  getSlots: () => Record<SlotLetter, BoardSlotData | null>;
  getStack?: () => StackArrangement | null;
  variant?: "button" | "menuItem";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takenName, setTakenName] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setName("");
    setSaving(false);
    setError(null);
    setTakenName(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    setTakenName(null);

    const slots = getSlots();
    const slotsPayload = Object.fromEntries(
      SLOT_LETTERS.filter((l) => slots[l] && slots[l]!.lines.length > 0).map((l) => [l, slots[l]])
    );

    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, slots: slotsPayload }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; slug?: string; displayName?: string } | null;
      if (!res.ok) {
        if (res.status === 409) setTakenName(trimmed);
        else setError(data?.error ?? "Something went wrong");
        setSaving(false);
        return;
      }

      const stack = getStack?.();
      if (stack && stack.steps.length > 0) {
        await fetch(`/api/boards/${data?.slug ?? trimmed}/stack`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stack),
        }).catch(() => {});
      }

      router.push(`/${data?.displayName ?? trimmed}`);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Save whatever's on screen to a new page of your own"
        className={
          variant === "menuItem"
            ? "block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
            : "rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
        }
      >
        Save a copy
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-sm rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Save a copy</h2>
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
              Saves whatever&apos;s currently on screen — including anything you&apos;ve messed with — to a brand new
              page of your own. The original never changes.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm text-white/70">
                <span className="text-xs text-white/40">/</span>
                <input
                  {...NO_PASSWORD_MANAGER_ATTRS}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setTakenName(null);
                    setError(null);
                  }}
                  placeholder="YourName"
                  maxLength={24}
                  className="flex-1 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {takenName && (
                <p className="text-xs text-white/40">
                  <span className="font-mono text-white/60">/{takenName}</span> is already someone&apos;s. Nothing&apos;s
                  locked around here, though —{" "}
                  <Link
                    href={`/${takenName}`}
                    className="font-semibold text-yellow-400 underline decoration-dotted hover:text-yellow-300"
                  >
                    Be Sneaky and peek anyway
                  </Link>
                  .
                </p>
              )}
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="mt-1 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save a copy"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
