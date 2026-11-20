import type { MetadataRoute } from "next";

/** Installable app (Add to Home Screen). Icons are drawn by app/pwa-icon/[size]. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swiss Liquidity",
    short_name: "Swiss Liquidity",
    description: "Your LP account, funds and trades in one secure place.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c0a",
    theme_color: "#0b0c0a",
    categories: ["finance"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
