import { faqItems } from "./faq-data";

export function Faq() {
  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-center">
          Les questions qu&apos;on nous pose
        </h2>
        <div className="mt-8 space-y-3">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-border bg-surface px-5 py-4"
            >
              <summary className="cursor-pointer list-none font-semibold flex items-center justify-between gap-4">
                {item.question}
                <span className="text-gold-400 transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm text-muted leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
