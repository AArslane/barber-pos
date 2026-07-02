export default function CaisseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Plein écran tablette : pas de chrome, les écrans caisse gèrent leur propre en-tête.
  return <div className="flex-1 flex flex-col h-dvh overflow-hidden">{children}</div>;
}
