import type { Metadata } from "next";
import "./globals.css";
import "./selected-pilot.css";
import "./city-suggest.css";
import "./navigation-layout.css";

export const metadata: Metadata = {
  title: "Bon de pilotage",
  description:
    "Formulaire de saisie bon de pilotage",
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
