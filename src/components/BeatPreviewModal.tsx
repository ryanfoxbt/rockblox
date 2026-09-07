"use client";

import { BeatPreview } from "@/components/BeatPreview";

// Spy uses this; Explore renders <BeatPreview> in its own side panel instead.
export function BeatPreviewModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/15 bg-slate-900 text-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end p-2 pb-0">
          <button type="button" onClick={onClose} className="px-2 text-white/50 hover:text-red-400">
            ✕
          </button>
        </div>
        <BeatPreview slug={slug} />
      </div>
    </div>
  );
}
