import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "@/lib/supabase/config";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * Route protection + session refresh (Next 16 proxy, formerly middleware).
 * Matches /dashboard/* and /onboarding/* (session auth) and /api/cron/* (shared
 * secret). Public profile routes (/[handle]/*) never pass through here.
 */
export default async function proxy(request: NextRequest) {
  // Cron endpoints: require the shared secret, enforced BEFORE the Supabase
  // shortcut below so they are never left open when keys aren't configured.
  // Unauthorized callers get 401, not the page-route login redirect.
  if (request.nextUrl.pathname.startsWith("/api/cron")) {
    return isCronAuthorized(request)
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Keys not pasted yet: let dev traffic through instead of dead-ending
  // every protected route at /login.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates the JWT against Supabase — never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/api/cron/:path*"],
};
