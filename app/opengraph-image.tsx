import { ImageResponse } from "next/og";

export const alt = "YTS Orbital - Satellite Operations & Orbital Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, color: "#e8fbfc", background: "#03070b", fontFamily: "sans-serif", border: "16px solid #0b2832" }}><div style={{ color: "#5de8e8", fontSize: 24, letterSpacing: 5 }}>YORK TECH SERVICES R&D</div><div style={{ display: "flex", alignItems: "center", gap: 35, marginTop: 36 }}><div style={{ width: 150, height: 150, borderRadius: 999, border: "5px solid #4ddce1", boxShadow: "0 0 50px #168f99", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>O</div><div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 74, fontWeight: 800, letterSpacing: 3 }}>YTS ORBITAL</div><div style={{ fontSize: 30, color: "#9db7bc", marginTop: 10 }}>Satellite Operations & Orbital Intelligence</div></div></div><div style={{ display: "flex", gap: 18, marginTop: 56, fontSize: 21, color: "#73d8da" }}><span>CELESTRAK GP</span><span>·</span><span>SGP4</span><span>·</span><span>3D ORBITAL VISUALIZATION</span><span>·</span><span>v0.1</span></div></div>, size);
}