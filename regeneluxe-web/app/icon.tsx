import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** 32×32 black square with white geometric R monogram. */
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
          background: "#0c0e12",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        R
      </div>
    ),
    { ...size }
  );
}
