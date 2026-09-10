"use client";

import { useEffect, useState, type CSSProperties } from "react";

const COLORS = ["#facc15", "#f87171", "#60a5fa", "#34d399", "#c084fc", "#fb923c"];

interface Piece {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
  drift: number;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.25,
    duration: 1.6 + Math.random() * 0.9,
    rotation: 180 + Math.random() * 540,
    drift: (Math.random() - 0.5) * 220,
  }));
}

// A celebratory confetti burst on a correct RockBlocks Math answer — pure
// CSS keyframe animation (see the confetti-fall keyframes in globals.css),
// no external dependency. Re-fires every time `burstKey` changes to a new,
// non-zero value, so the caller just increments a counter to replay it.
export function Confetti({ burstKey }: { burstKey: number }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    if (burstKey === 0) return;
    // Reacting to an external trigger (the caller incrementing burstKey on a
    // correct answer) rather than deriving from props/state, so there's no
    // way to compute this during render instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(makePieces(28));
    const timeout = setTimeout(() => setPieces(null), 3000);
    return () => clearTimeout(timeout);
  }, [burstKey]);

  if (!pieces) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--confetti-drift": `${p.drift}px`,
              "--confetti-rotation": `${p.rotation}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
