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

  // Rafraîchit les deux sessions (maintient les cookies à jour) et récupère
  // l'utilisateur de chaque scope — la caisse et l'admin sont des sessions
  // indépendantes sur la même tablette.
  const [caisseSession, ownerSession] = await Promise.all([
    getScopedUser(request, response, "caisse"),
    getScopedUser(request, response, "owner"),
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

  const isOwnerArea = pathname.startsWith("/dashboard");
  const isCaisse = pathname.startsWith("/caisse");
  const isOwnerLogin = pathname === "/proprietaire";
  // Sous-pages (ex. l'onboarding) : nécessitent une session owner authentifiée,
  // même si aucun shop n'existe encore.
  const isOwnerSubPage = pathname.startsWith("/proprietaire/");
  const isCaisseLogin = pathname === "/login";
  const isInscription = pathname === "/inscription";

  if ((isOwnerArea || isOwnerSubPage) && !ownerUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/proprietaire";
    return NextResponse.redirect(url);
  }

  if (isCaisse && !caisseUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isCaisseLogin && caisseUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/caisse";
    return NextResponse.redirect(url);
  }

  if ((isOwnerLogin || isInscription) && ownerUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icons|sw.js|sitemap.xml|robots.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
