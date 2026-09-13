"use client";

import { useState } from "react";
import {
  Bassline,
  BASS_VOICES,
  BasslineMode,
  BasslineSettings,
  BassVoiceId,
  DEFAULT_BASSLINE_SETTINGS,
  MAX_FILLS,
  MAX_MELODY_COMPLEXITY,
  MIN_FILLS,
  MIN_MELODY_COMPLEXITY,
} from "@/lib/bassline";
import { midiNoteName, NOTE_NAMES, SCALES, scalesByGroup } from "@/lib/scales";

// Trigger + modal for the generated bassline: pick a key root and scale, a
// mode (Groove locks onto the beat's kick and snare; Melody composes freely
// across the bar), how busy the line is on that mode's own dial, and
// (re-)roll it. Every setting only ever applies to the *next* roll — the
// current line only changes on its own when key/octave/scale re-pitch it in
// place, or when Generate/Regenerate is actually clicked — same as the drum
// randomizer never touching the pattern until you hit its button. Kept out of
// Editor so its transient form state doesn't add to the editor's already-long
// state list. The Editor owns the drum pattern, so generation itself is a
// callback.
//
// The modal (BasslineModal) is rendered by Editor at the top level rather than
// nested here, because this trigger lives inside the header tools menu — which
// unmounts when the menu closes — and the read-only BasslineRow's "Edit"
// button also needs to open it.

export function BasslineButton({
  onOpen,
  variant = "menuItem",
  disabled = false,
}: {
  onOpen: () => void;
  variant?: "button" | "menuItem";
  // There's nothing for generateBassline to follow yet — no kick/snare
  // onsets to anchor notes on — until the drum pattern has at least one hit.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      title="Bassline — generate a bass part that follows the beat"
      className={
        (variant === "menuItem"
          ? "block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400") +
        " disabled:pointer-events-none disabled:opacity-30"
      }
    >
      {variant === "menuItem" ? (
        "Bassline"
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M5 3v14" strokeLinecap="round" />
          <circle cx="5" cy="19" r="2.5" />
          <path d="M12 6v11" strokeLinecap="round" />
          <circle cx="12" cy="19" r="2.5" />
          <path d="M19 4v9" strokeLinecap="round" />
          <circle cx="19" cy="15" r="2.5" />
        </svg>
      )}
    </button>
  );
}

export function BasslineModal({
  bassline,
  onGenerate,
  onSettingsChange,
  onVoiceChange,
  onRemove,
  onClose,
}: {
  bassline: Bassline | null;
  onGenerate: (settings: BasslineSettings) => void;
  // Live edits to an existing line: key / octave / scale re-pitch the current
  // notes in place; everything else (mode, Fills/Complexity, volume) just
  // updates settings for whenever the line is next (re)generated — it never
  // touches the current notes on its own. No-op until a line exists (the
  // "Generate bassline" button makes the first one).
  onSettingsChange: (settings: BasslineSettings) => void;
  // Changing the bass sound doesn't re-roll the notes — it applies straight
  // away so you can audition tones against the same line.
  onVoiceChange: (voice: BassVoiceId) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<BasslineSettings>(() => ({
    ...DEFAULT_BASSLINE_SETTINGS,
    ...(bassline?.settings ?? {}),
  }));
  const [justGenerated, setJustGenerated] = useState(false);

  const hasBassline = !!bassline && bassline.notes.length > 0;
  const previewNotes = bassline?.notes ?? [];
  const isMelody = settings.mode === "melody";

  // Update one field. When a line already exists the change applies immediately
  // — for key/octave/scale that's a re-pitch in place, for everything else
  // it's just saved for next time the line is (re)generated (see
  // handleBasslineSettingsChange in Editor).
  function set<K extends keyof BasslineSettings>(key: K, value: BasslineSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (hasBassline) onSettingsChange(next);
  }

  function generate() {
    onGenerate(settings);
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Bassline</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-white/5 p-1">
          {(["groove", "melody"] as BasslineMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set("mode", m)}
              className={
                "rounded-md px-2 py-1 text-sm font-medium capitalize transition " +
                (settings.mode === m ? "bg-yellow-400 text-slate-900" : "text-white/60 hover:text-white")
              }
            >
              {m}
            </button>
          ))}
        </div>

        <p className="mb-3 text-xs text-white/50">
          {isMelody
            ? "Composed freely across the bar, independent of your drum pattern. Snapped to your scale."
            : "Follows the kick and snare of the beat on screen. Snapped to your scale."}
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm text-white/70">
            Key
            <select
              value={settings.root}
              onChange={(e) => set("root", Number(e.target.value))}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
            >
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i} className="bg-slate-900">
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-white/70">
            Octave
            <select
              value={settings.octave}
              onChange={(e) => set("octave", Number(e.target.value))}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
            >
              {[1, 2, 3].map((o) => (
                <option key={o} value={o} className="bg-slate-900">
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-3 flex flex-col gap-1 text-sm text-white/70">
          Scale
          <select
            value={settings.scale}
            onChange={(e) => set("scale", e.target.value as BasslineSettings["scale"])}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
          >
            {scalesByGroup().map(({ group, ids }) => (
              <optgroup key={group} label={group} className="bg-slate-900">
                {ids.map((id) => (
                  <option key={id} value={id} className="bg-slate-900">
                    {SCALES[id].name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="mb-3 flex flex-col gap-1 text-sm text-white/70">
          Sound
          <select
            value={settings.voice}
            onChange={(e) => {
              const voice = e.target.value as BassVoiceId;
              setSettings((prev) => ({ ...prev, voice }));
              onVoiceChange(voice);
            }}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
          >
            {BASS_VOICES.map((v) => (
              <option key={v.id} value={v.id} className="bg-slate-900">
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-1 flex items-center justify-between text-sm text-white/70">
          <span>{isMelody ? "Complexity" : "Fills"}</span>
          <span className="font-mono text-yellow-400">
            {isMelody ? settings.melodyComplexity : settings.fills}
          </span>
        </label>
        {isMelody ? (
          <input
            type="range"
            min={MIN_MELODY_COMPLEXITY}
            max={MAX_MELODY_COMPLEXITY}
            step={1}
            value={settings.melodyComplexity}
            onChange={(e) => set("melodyComplexity", Number(e.target.value))}
            className="w-full accent-yellow-400"
          />
        ) : (
          <input
            type="range"
            min={MIN_FILLS}
            max={MAX_FILLS}
            step={1}
            value={settings.fills}
            onChange={(e) => set("fills", Number(e.target.value))}
            className="w-full accent-yellow-400"
          />
        )}
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-white/40">
          <span>{isMelody ? "Simple & singable" : "Root-locked"}</span>
          <span>{isMelody ? "Wild & ornamented" : "Busy walking"}</span>
        </div>
        {hasBassline && (
          <p className="mt-1 text-[10px] text-white/40">
            Key, octave and scale re-pitch the current line in place. Everything else applies next time you hit
            Regenerate.
          </p>
        )}

        <label className="mb-1 mt-4 flex items-center justify-between text-sm text-white/70">
          <span>Volume</span>
          <span className="font-mono text-yellow-400">{settings.volume}</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={settings.volume}
          onChange={(e) => set("volume", Number(e.target.value))}
          className="w-full accent-yellow-400"
          aria-label="Bassline volume"
        />

        <button
          type="button"
          onClick={generate}
          className="mt-4 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
        >
          {hasBassline ? "Regenerate" : "Generate bassline"}
        </button>
        {justGenerated && (
          <p className="mt-2 text-center text-sm text-yellow-400">Bassline created!</p>
        )}

        {hasBassline && (
          <>
            <div className="mt-3 max-h-20 overflow-y-auto rounded-md border border-white/10 bg-white/5 p-2 text-[11px] leading-relaxed text-white/60">
              {previewNotes.map((n, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-white/25"> · </span>}
                  <span className={n.accent === "ghost" ? "text-white/35" : ""}>
                    {midiNoteName(n.midi)}
                  </span>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="mt-2 w-full rounded-md border border-white/10 px-3 py-1 text-xs text-white/50 transition hover:border-red-400 hover:text-red-400"
            >
              Remove bassline
            </button>
          </>
        )}
      </div>
    </div>
  );
}
