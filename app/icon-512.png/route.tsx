import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 96,
          overflow: "hidden",
          position: "relative",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 52,
            right: 48,
            top: 210,
            height: 12,
            background: "#ed0016",
            transform: "skewX(-18deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -22,
            top: 42,
            width: 230,
            height: 155,
            borderTop: "48px solid #000000",
            borderLeft: "48px solid #000000",
            borderRadius: "210px 0 0 0",
            transform: "rotate(-10deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -16,
            bottom: 78,
            width: 245,
            height: 138,
            background: "#ed0016",
            transform: "skewX(24deg)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            transform: "skewX(-10deg)",
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 148, fontWeight: 900, lineHeight: 0.9, color: "#000000" }}>Elite</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#000000", marginLeft: 196 }}>GUIDAGE</div>
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
