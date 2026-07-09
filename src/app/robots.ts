import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

// /inscription reste crawlable : c'est la cible du CTA.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/caisse", "/proprietaire", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
