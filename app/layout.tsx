import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bon de pilotage",
  description:
    "Formulaire de saisie, génération PDF et envoi e-mail pour les bons de pilotage.",
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
