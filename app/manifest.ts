import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elite Guidage - Bon de pilotage",
    short_name: "Elite Guidage",
    description: "Application de saisie des bons de pilotage Elite Guidage.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f1f2f4",
    theme_color: "#ffcc00",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
