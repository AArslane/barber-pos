import { Hero } from "@/components/marketing/Hero";
import { PainPoints } from "@/components/marketing/PainPoints";
import { DemoTabs } from "@/components/marketing/DemoTabs";
import { Faq } from "@/components/marketing/Faq";
import { faqItems } from "@/components/marketing/faq-data";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FinalCta } from "@/components/marketing/FinalCta";

// Schema.org FAQPage — même source que le composant Faq. Le replace échappe
// "<" pour empêcher toute injection HTML dans le script inline (recommandation
// de la doc Next, guide json-ld).
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Hero />
      <PainPoints />
      <DemoTabs />
      <Faq />
      <PricingSection />
      <FinalCta />
    </>
  );
}
