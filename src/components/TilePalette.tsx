import { NOTE_TILES, REST_TILES } from "@/lib/rhythm";
import { DraggableTile } from "./DraggableTile";

export function TilePalette() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
          Notes <span className="text-white/30">({NOTE_TILES.length})</span>
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {NOTE_TILES.map((t) => (
            <DraggableTile key={t.id} tile={t} />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
          Rests <span className="text-white/30">({REST_TILES.length})</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 pb-2">
          {REST_TILES.map((t) => (
            <DraggableTile key={t.id} tile={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
