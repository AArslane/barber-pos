// Service worker servi comme route (pas un fichier statique) : le nom du
// cache est dérivé d'un identifiant de build, calculé une fois par déploiement
// (module chargé au cold start), pour que chaque déploiement invalide
// automatiquement l'ancien cache sans avoir à incrémenter un numéro à la main.
//
// Note : on a tenté de migrer vers Serwist (@serwist/next) comme demandé,
// mais son plugin webpack est incompatible avec Next 16 qui utilise Turbopack
// par défaut pour `next build` (erreur "This build is using Turbopack, with a
// webpack config and no turbopack config"). Serwist n'a qu'un support Turbopack
// expérimental distinct (@serwist/turbopack). On garde donc ce SW manuel,
// durci ci-dessous, et on note l'incompatibilité dans le rapport final.

const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  process.env.NEXT_BUILD_ID ??
  String(Date.now());

const SW_SOURCE = `
// Service worker minimal : la caisse doit se lancer même sans réseau.
// - pages (navigations) : network-first, fallback cache
// - assets /_next/static et icônes : cache-first (immutables)
const CACHE = "barber-pos-${BUILD_ID}";
const PRECACHE_URLS = ["/caisse", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE_URLS).catch(() => c.add("/caisse")))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/caisse");
        })
    );
  }
});
`;

export function GET() {
  return new Response(SW_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
