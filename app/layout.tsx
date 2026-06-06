import type { Metadata } from "next";
import "./globals.css";
import "./selected-pilot.css";
import "./city-suggest.css";
import "./navigation-layout.css";

export const metadata: Metadata = {
  title: "Bon de pilotage",
  description:
    "Formulaire de saisie bon de pilotage",
  manifest: "/manifest.webmanifest",
  themeColor: "#ffcc00",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
