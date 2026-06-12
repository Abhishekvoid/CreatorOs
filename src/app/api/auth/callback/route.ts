import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postAuthDestination } from "@/lib/auth";

/**
 * Supabase PKCE callback. Google OAuth lands here with a ?code=...;
 * we exchange it for a session, then route by profile state:
 * no profiles row → /onboarding/handle, mid-wizard → their current step,
 * published → /dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const destination = await postAuthDestination(supabase, user.id);
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
