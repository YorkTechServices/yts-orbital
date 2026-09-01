import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#06131a", color: "#64edf0", border: "3px solid #2ba7ad", borderRadius: 12, fontSize: 30, fontWeight: 800 }}>O</div>, size);
}