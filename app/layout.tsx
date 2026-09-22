import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://orbital.yorktechservices.com"),
  title: "YTS Orbital | Satellite Operations & Orbital Intelligence",
  description: "Explore current public orbital elements with SGP4 propagation, interactive 3D visualization, time simulation, and geometric pass prediction.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "YTS Orbital",
    description: "Satellite Operations & Orbital Intelligence",
    url: "/",
    siteName: "York Tech Services",
    images: [{ url: "/applications-orbital-preview.png", width: 537, height: 360, alt: "YTS Orbital mission dashboard" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "YTS Orbital", description: "Satellite Operations & Orbital Intelligence", images: ["/applications-orbital-preview.png"] },
};

export const viewport: Viewport = { themeColor: "#03070b", colorScheme: "dark" };

const GOOGLE_ANALYTICS_ID = "G-TYNC7SJGNB";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ANALYTICS_ID}');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}