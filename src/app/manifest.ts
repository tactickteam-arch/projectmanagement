import type { MetadataRoute } from "next";

/** Lets people install the tracker on their phone's home screen ("Add to Home screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Store Launch Tracker · Sangeetha Mobiles",
    short_name: "Store Launch",
    description: "Tracks every new Sangeetha Mobiles store from location finalisation to launch.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c21725",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
