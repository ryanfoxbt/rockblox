import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same 2x2 beat-block mark as icon.tsx, scaled up for iOS home-screen
// bookmarks (Apple applies its own rounded-corner mask, so this fills the
// full square with an opaque background rather than relying on our own
// corner radius).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 62, height: 62, borderRadius: 12, background: "#facc15" }} />
            <div style={{ width: 62, height: 62, borderRadius: 12, background: "#e2e8f0" }} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 62, height: 62, borderRadius: 12, background: "#e2e8f0" }} />
            <div style={{ width: 62, height: 62, borderRadius: 12, background: "#facc15" }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
