import { SwRegister } from "@/components/SwRegister";

export default function CaisseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Plein écran tablette : pas de chrome, les écrans caisse gèrent leur propre en-tête.
  // Le service worker n'est enregistré qu'ici : les visiteurs des pages
  // marketing n'ont pas besoin de la PWA (scope / conservé via Service-Worker-Allowed).
  return (
    <div className="flex-1 flex flex-col h-dvh overflow-hidden">
      <SwRegister />
      {children}
    </div>
  );
}
