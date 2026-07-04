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
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Rafraîchit les deux sessions (maintient les cookies à jour) et récupère
  // l'utilisateur de chaque scope — la caisse et l'admin sont des sessions
  // indépendantes sur la même tablette.
  const [caisseUser, ownerUser] = await Promise.all([
    getScopedUser(request, response, "caisse"),
    getScopedUser(request, response, "owner"),
  ]);

  const isOwnerArea = pathname.startsWith("/dashboard");
  const isCaisse = pathname.startsWith("/caisse");
  const isOwnerLogin = pathname === "/proprietaire";
  // Sous-pages (ex. l'onboarding) : nécessitent une session owner authentifiée,
  // même si aucun shop n'existe encore.
  const isOwnerSubPage = pathname.startsWith("/proprietaire/");
  const isCaisseLogin = pathname === "/login";

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

  if (isOwnerLogin && ownerUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icons|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
