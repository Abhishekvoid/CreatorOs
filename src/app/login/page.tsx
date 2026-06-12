import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth/AuthScreen";
import { postAuthDestination } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Log in | CreatorOS",
  description: "Log in with Google or your phone number to manage your creator business.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(await postAuthDestination(supabase, user.id));
  }

  const { error } = await searchParams;
  const initialError =
    error === "oauth" ? "Sign-in didn't complete — please try again." : undefined;

  return <AuthScreen mode="login" initialError={initialError} />;
}
