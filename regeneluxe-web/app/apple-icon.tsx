import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** 180×180 Apple touch icon — black bg, white bold R. */
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
          background: "#0c0e12",
          color: "#ffffff",
          fontSize: 118,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          borderRadius: 36,
        }}
      >
        R
      </div>
    ),
    { ...size }
  );
}
