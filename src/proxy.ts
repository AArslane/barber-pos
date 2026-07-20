import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/lib/supabase/client";

async function getScopedUser(
  request: NextRequest,
  response: NextResponse,
  scope: "caisse" | "owner"
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: SESSION_COOKIE_NAMES[scope] },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Transmis aux Server Components via headers() : utilisé par le layout
  // dashboard pour ne pas gater /dashboard/reglages (l'owner doit toujours
  // pouvoir y accéder pour gérer son abonnement).
  request.headers.set("x-pathname", pathname);
  const response = NextResponse.next({ request });

  const isOwnerArea = pathname.startsWith("/dashboard");
  const isCaisse = pathname.startsWith("/caisse");
  // Sous-pages (ex. l'onboarding) : nécessitent une session owner authentifiée,
  // même si aucun shop n'existe encore. /proprietaire lui-même redirige vers
  // /login (page), la connexion est unifiée.
  const isOwnerSubPage = pathname.startsWith("/proprietaire/");
  const isLogin = pathname === "/login";
  const isInscription = pathname === "/inscription";

  // Chaque appel getUser est un aller-retour réseau vers Supabase : on ne
  // résout que le ou les scopes dont la route a réellement besoin. Les pages
  // publiques (landing, tarifs, mentions…) n'en paient aucun.
  const needsCaisse = isCaisse || isLogin || pathname === "/";
  const needsOwner = isOwnerArea || isOwnerSubPage || isLogin || isInscription;

  // La caisse et l'admin sont des sessions indépendantes sur la même tablette ;
  // getScopedUser rafraîchit aussi les cookies du scope qu'il résout.
  const [caisseSession, ownerSession] = await Promise.all([
    needsCaisse ? getScopedUser(request, response, "caisse") : null,
    needsOwner ? getScopedUser(request, response, "owner") : null,
  ]);

  // Chaque scope n'accepte que son type de compte (app_metadata.role est posé
  // côté serveur à la création, présent dans le JWT, infalsifiable) : la caisse
  // exige un compte tablette, l'espace propriétaire refuse les comptes tablette.
  // Un compte du mauvais type est traité comme non connecté.
  const caisseUser = caisseSession?.app_metadata.role === "device" ? caisseSession : null;
  const ownerUser = ownerSession && ownerSession.app_metadata.role !== "device" ? ownerSession : null;

  // La racine est la landing marketing publique — sauf pour une tablette
  // connectée (session device), qui garde son comportement historique.
  if (pathname === "/" && caisseUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/caisse";
    return NextResponse.redirect(url);
  }

  // ?owner=1 : re-authentification propriétaire demandée depuis la caisse — on
  // ne renvoie pas vers /caisse même si la session tablette est active.
  const wantsOwner = request.nextUrl.searchParams.get("owner") === "1";

  if ((isOwnerArea || isOwnerSubPage) && !ownerUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "owner=1";
    return NextResponse.redirect(url);
  }

  if (isCaisse && !caisseUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLogin && ownerUser && (wantsOwner || !caisseUser)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLogin && caisseUser && !wantsOwner) {
    const url = request.nextUrl.clone();
    url.pathname = "/caisse";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isInscription && ownerUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icons|sw.js|sitemap.xml|robots.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
