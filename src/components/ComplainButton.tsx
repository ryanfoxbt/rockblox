"use client";

import { useState } from "react";

export function ComplainButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function close() {
    setOpen(false);
    setMessage("");
    setStatus("idle");
  }

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, url: window.location.href }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Complain"
        className="fixed bottom-3 right-3 z-40 text-base opacity-25 grayscale transition hover:opacity-80 hover:grayscale-0"
      >
        😠
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">😠 Complain</h2>
              <button
                type="button"
                onClick={close}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>

            {status === "sent" ? (
              <p className="py-4 text-center text-sm text-white/70">
                Noted. We&apos;ll do nothing about it.
              </p>
            ) : (
              <>
                <textarea
                  autoFocus
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Complain about anything"
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-none rounded-md border border-white/15 bg-white/5 p-2.5 text-sm text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
                />
                {status === "error" && (
                  <p className="mt-1.5 text-xs text-red-400">Couldn&apos;t send, try again</p>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!message.trim() || status === "sending"}
                    className="rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
                  >
                    {status === "sending" ? "Sending…" : "Complain"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
