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
          borderRadius: 36,
          overflow: "hidden",
          position: "relative",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 18,
            top: 78,
            height: 5,
            background: "#ed0016",
            transform: "skewX(-18deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -10,
            top: 18,
            width: 86,
            height: 58,
            borderTop: "18px solid #000000",
            borderLeft: "18px solid #000000",
            borderRadius: "80px 0 0 0",
            transform: "rotate(-10deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -6,
            bottom: 30,
            width: 92,
            height: 52,
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
          <div style={{ fontSize: 55, fontWeight: 900, lineHeight: 0.9, color: "#000000" }}>Elite</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#000000", marginLeft: 73 }}>GUIDAGE</div>
        </div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
