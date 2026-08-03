import type { MetadataRoute } from "next";

// Web App Manifest — App Router metadata route → served at /manifest.webmanifest.
// Makes the app installable as a tablet-oriented, landscape-locked kiosk PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "우리 책장",
    short_name: "책장",
    description: "PDF를 업로드해서 책처럼 넘겨 볼 수 있는 어린이 그림책 뷰어",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "ko",
    // Fullscreen for kiosk immersion; standalone fallback where fullscreen is unsupported.
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    // Honored by installed Android PWAs; iOS ignores this (handled by OrientationGate).
    orientation: "landscape",
    background_color: "#fff0c9",
    theme_color: "#f06f5f",
    icons: [
      { src: "/app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  };
}
