import { SentenceRuleTrace } from "@/lib/textToBeat";

// The diagnostic readout behind each slot's "Rules used" toggle in
// TextToBeatButton — shows exactly which deterministic rule decided each
// piece of the generated groove (time signature, density curve, voice
// width, then a per-word breakdown of voice/hits/tile/accent), so the
// generator's choices aren't a black box while it's still being tuned. See
// lib/textToBeat.ts's SentenceRuleTrace for what's captured.
export function RulesUsedPanel({ trace }: { trace: SentenceRuleTrace }) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/60">
        <span>
          Time signature <span className="font-mono text-yellow-400">{trace.beatsPerMeasure}/4</span>
        </span>
        <span>
          Density curve <span className="font-mono text-yellow-400">{trace.densityCurve}</span>
        </span>
        <span>
          Voice width <span className="font-mono text-yellow-400">{trace.voiceWidth}</span>
        </span>
      </div>
      {trace.longestWord && (
        <div className="text-white/60">
          Tom accent on <span className="font-mono text-yellow-400">&quot;{trace.longestWord}&quot;</span>
          {trace.longestWordTom ? ` (${trace.longestWordTom})` : ""}
          {trace.secondWord && (
            <>
              {" "}
              and <span className="font-mono text-yellow-400">&quot;{trace.secondWord}&quot;</span>
              {trace.secondWordTom ? ` (${trace.secondWordTom})` : ""}
            </>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left">
          <thead>
            <tr className="text-white/40">
              <th className="pr-3 font-normal">Word</th>
              <th className="pr-3 font-normal">Voice</th>
              <th className="pr-3 font-normal">Hits</th>
              <th className="pr-3 font-normal">Tile</th>
              <th className="pr-3 font-normal">Accent</th>
            </tr>
          </thead>
          <tbody>
            {trace.words.map((w, i) => (
              <tr key={i} className="text-white/70">
                <td className="pr-3">
                  {w.word}
                  {w.isFunctionWord && <span className="text-white/30"> (fn)</span>}
                </td>
                <td className="pr-3 font-mono">{w.voice}</td>
                <td className="pr-3 font-mono">{w.hits}</td>
                <td className="pr-3 font-mono">{w.tileId}</td>
                <td className="pr-3 font-mono">
                  {[w.phoneticAccent, w.comma && "comma", w.exclaim && "!", w.question && "?"]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
