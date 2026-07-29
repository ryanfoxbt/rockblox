import { NOTE_UNITS, RhythmTile } from "@/lib/rhythm";

export function TileVisual({ tile, height = 32 }: { tile: RhythmTile; height?: number }) {
  return (
    <div
      className="flex w-full overflow-hidden rounded border border-white/20"
      style={{ height }}
    >
      {tile.hits.map((h, i) => {
        const widthPct = (NOTE_UNITS[h.note] / 4) * 100;
        const isRest = h.type === "rest";
        return (
          <div
            key={i}
            className="flex h-full items-center justify-center border-r border-black/20 last:border-r-0"
            style={{
              width: `${widthPct}%`,
              background: isRest
                ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)"
                : "rgba(255,255,255,0.85)",
            }}
          />
        );
      })}
    </div>
  );
}
