import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

export const alt = `${BRAND_NAME} — Caisse et commissions pour barbershops`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#0C0A09",
          color: "#FAFAF9",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 40, letterSpacing: 8, color: "#D4A24E" }}>
          {BRAND_NAME.toUpperCase()}
        </div>
        <div style={{ fontSize: 56, textAlign: "center", lineHeight: 1.2 }}>
          Tu sais enfin combien chaque coiffeur t&apos;a rapporté.
        </div>
        <div style={{ fontSize: 28, color: "#A8A29E", textAlign: "center" }}>
          Caisse tablette + commissions auto — essai gratuit 14 jours, sans CB
        </div>
      </div>
    ),
    { ...size }
  );
}
