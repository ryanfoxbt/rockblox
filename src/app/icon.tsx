import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The mark is a 2x2 step-sequencer grid with two hits lit — literally the
// product's own beat-block UI reduced to its simplest form, in the app's
// actual accent color, rather than an invented symbol.
export default function Icon() {
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
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", gap: 3 }}>
            <div style={{ width: 11, height: 11, borderRadius: 2, background: "#facc15" }} />
            <div style={{ width: 11, height: 11, borderRadius: 2, background: "#e2e8f0" }} />
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            <div style={{ width: 11, height: 11, borderRadius: 2, background: "#e2e8f0" }} />
            <div style={{ width: 11, height: 11, borderRadius: 2, background: "#facc15" }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
