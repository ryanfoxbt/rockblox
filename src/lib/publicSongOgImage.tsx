import { ImageResponse } from "next/og";
import { publicSongSummary, type PublicSong } from "@/lib/publicSong";

// The 1200x630 social card for a shared song (/s/<slug> and its /stack).
// Same visual language as src/app/opengraph-image.tsx — dark gradient, the
// RockBlocks wordmark, a row of beat blocks — but headlined with the song's
// own title and its "6 sections · 0:48" summary so a LinkedIn/Slack unfurl
// says what the link actually is.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "A drum song made on RockBlocks — press play, remix it, or save your own copy.";

const YELLOW = "#facc15";
const LIGHT = "#e2e8f0";
// Which of the 12 blocks in the bottom row are "hit" — a plausible groove.
const LIT = new Set([0, 2, 4, 5, 7, 9, 10]);

export function renderPublicSongOgImage(song: PublicSong | null): ImageResponse {
  const title = song?.title?.trim() || "A drum song";
  const summary = song ? publicSongSummary(song) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "linear-gradient(to bottom, #020617, #0f172a, #020617)",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
          <span style={{ color: "#fff" }}>Rock</span>
          <span style={{ color: YELLOW }}>Blocks</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: title.length > 34 ? 60 : 78,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: -2,
            lineHeight: 1.05,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: "#94a3b8" }}>
          {summary ? `${summary}  ·  a drum song on RockBlocks` : "a drum song on RockBlocks"}
        </div>

        <div style={{ display: "flex", marginTop: 46, gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: LIT.has(i) ? YELLOW : LIGHT,
                opacity: LIT.has(i) ? 1 : 0.14,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#64748b" }}>
          Press play · remix it in your browser · save your own copy — free, no login
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
