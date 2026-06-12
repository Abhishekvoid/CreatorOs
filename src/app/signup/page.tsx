import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth/AuthScreen";
import { postAuthDestination } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Claim your link | CreatorOS",
  description: "Sign up with Google or your phone number and claim creatoros.in/you.",
};

export default async function SignupPage() {
  // Already signed in? Skip straight to wherever they belong.
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(await postAuthDestination(supabase, user.id));
  }

  return <AuthScreen mode="signup" />;
}
