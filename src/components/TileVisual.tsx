import { NOTE_FRACTION, RhythmTile } from "@/lib/rhythm";

export function TileVisual({
  tile,
  height = 32,
  onToggleHit,
}: {
  tile: RhythmTile;
  height?: number;
  onToggleHit?: (index: number) => void;
}) {
  return (
    <div className="flex w-full overflow-hidden rounded border border-white/20" style={{ height }}>
      {tile.hits.map((h, i) => {
        const widthPct = NOTE_FRACTION[h.note] * 100;
        const isRest = h.type === "rest";
        const style = {
          width: `${widthPct}%`,
          background: isRest
            ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)"
            : "rgba(255,255,255,0.85)",
        };

        if (!onToggleHit) {
          return (
            <div
              key={i}
              className="h-full border-r border-black/20 last:border-r-0"
              style={style}
            />
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggleHit(i)}
            title={isRest ? "Rest — tap to sound this hit" : "Tap to turn this hit into a rest"}
            className="h-full border-r border-black/20 transition last:border-r-0 hover:brightness-90"
            style={style}
          />
        );
      })}
    </div>
  );
}
