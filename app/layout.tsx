import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yorktechservices.com"),
  title: "YTS Orbital | Satellite Operations & Orbital Intelligence",
  description: "Explore current public orbital elements with SGP4 propagation, interactive 3D visualization, time simulation, and geometric pass prediction.",
  alternates: { canonical: "/orbital" },
  openGraph: {
    title: "YTS Orbital",
    description: "Satellite Operations & Orbital Intelligence",
    url: "/orbital",
    siteName: "York Tech Services",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "YTS Orbital mission dashboard" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "YTS Orbital", description: "Satellite Operations & Orbital Intelligence", images: ["/opengraph-image"] },
};

export const viewport: Viewport = { themeColor: "#03070b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}