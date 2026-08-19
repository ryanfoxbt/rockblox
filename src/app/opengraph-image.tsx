import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const YELLOW = "#facc15";
const LIGHT = "#e2e8f0";

// A 4x4 grid echoing the app's own beat-block UI, with a handful of hits lit
// — the same visual language as icon.tsx, just given room to read as an
// actual drum pattern at this size instead of a single 2x2 glyph.
const LIT: Record<number, boolean> = { 1: true, 3: true, 6: true, 9: true, 11: true, 14: true };

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to bottom, #020617, #0f172a, #020617)",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 900, letterSpacing: -2 }}>
          <span style={{ color: "#fff" }}>Rock</span>
          <span style={{ color: YELLOW }}>Blocks</span>
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 32, color: "#94a3b8" }}>
          Build, play, and share drum beats — right in your browser
        </div>
        <div style={{ display: "flex", marginTop: 48, gap: 10 }}>
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 4 }).map((_, col) => {
                const i = row * 4 + col;
                return (
                  <div
                    key={col}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: LIT[i] ? YELLOW : LIGHT,
                      opacity: LIT[i] ? 1 : 0.15,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
