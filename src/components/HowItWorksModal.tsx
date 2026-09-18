"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const STEPS = [
  {
    title: "Build a beat",
    body: "Drag a rhythm tile into a beat block, or tap a tile then tap a block — one groove, built in seconds.",
  },
  {
    title: "Or type it — TextyBeat",
    body: "Type a sentence and TextyBeat turns it into a groove instantly, no dragging required.",
  },
  {
    title: "Claim your link and share it",
    body: "Name your page and get a link — rockblocks.com/you — ready to send or post anywhere.",
  },
];

// A drop-in trigger + modal for a first-time visitor who isn't sure what to
// do with the grid. Illustrations are small looping CSS animations (see
// globals.css) rather than a recorded video/GIF, so this needs no external
// assets and stays in sync with the app's own colors automatically.
export function HowItWorksModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-yellow-400 underline decoration-dotted transition hover:text-yellow-300"
      >
        See how it works
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">How RockBlocks works</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Close"
                  className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-5">
                <Step index={0} {...STEPS[0]}>
                  <DragIllustration />
                </Step>
                <Step index={1} {...STEPS[1]}>
                  <TypeIllustration />
                </Step>
                <Step index={2} {...STEPS[2]}>
                  <ShareIllustration />
                </Step>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
              >
                Got it — let&apos;s play
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Step({
  index,
  title,
  body,
  children,
}: {
  index: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
        {children}
      </div>
      <div>
        <p className="font-semibold text-yellow-400">
          {index + 1}. {title}
        </p>
        <p className="mt-0.5 text-sm text-white/70">{body}</p>
      </div>
    </div>
  );
}

function DragIllustration() {
  return (
    <div className="relative h-8 w-8">
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
        <div className="rounded-sm bg-white/10" />
        <div className="rounded-sm bg-white/10" />
        <div className="rounded-sm bg-white/10" />
        <div className="relative rounded-sm bg-white/10">
          <span className="how-drag-pulse absolute inset-0 rounded-sm bg-yellow-400/50" />
        </div>
      </div>
      <span className="how-drag-tile absolute right-0 top-0 h-3.5 w-3.5 rounded-sm bg-yellow-400" />
    </div>
  );
}

function TypeIllustration() {
  return (
    <div className="flex h-8 w-9 flex-col items-center justify-center gap-1.5">
      <div className="flex h-2 w-full items-center gap-0.5 rounded-sm bg-white/10 px-1">
        <span className="h-1 w-3 rounded-sm bg-white/30" />
        <span className="how-type-cursor h-1.5 w-0.5 bg-yellow-400" />
      </div>
      <div className="flex h-3.5 items-end gap-0.5">
        {[0, 0.15, 0.3, 0.45].map((delay) => (
          <span
            key={delay}
            className="how-type-bar h-full w-1 rounded-sm bg-yellow-400"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function ShareIllustration() {
  return (
    <div className="flex h-8 w-9 items-center justify-center">
      <span className="how-share-pop rounded-full border border-yellow-400/50 bg-yellow-400/10 px-1.5 py-1 font-mono text-[9px] leading-none text-yellow-400">
        /you ✓
      </span>
    </div>
  );
}
