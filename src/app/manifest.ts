import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barber POS",
    short_name: "Barber POS",
    description: "Caisse tablette pour barbershops",
    start_url: "/caisse",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0C0A09",
    theme_color: "#0C0A09",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
