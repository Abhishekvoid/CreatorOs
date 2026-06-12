"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LoaderCircle, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { postAuthDestination } from "@/lib/auth";

type View = "methods" | "phone" | "otp";

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const RESEND_SECONDS = 30;

/** Monochrome Google "G" — sits on the ink pill in cream. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 488 512" className={className} fill="currentColor" aria-hidden="true">
      <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
    </svg>
  );
}

export default function AuthCard({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>("methods");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (view === "phone") phoneInputRef.current?.focus();
    if (view === "otp") codeInputRef.current?.focus();
  }, [view]);

  function requireConfig(): boolean {
    if (isSupabaseConfigured) return true;
    setError("Supabase keys aren't set yet — paste them into .env.local and restart the dev server.");
    return false;
  }

  async function signInWithGoogle() {
    setError(null);
    if (!requireConfig()) return;
    setBusy(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    // On success the browser navigates away; we only land here on failure.
    if (oauthError) {
      setError("Google sign-in didn't start — please try again.");
      setBusy(false);
    }
  }

  async function sendOtp() {
    setError(null);
    if (!requireConfig()) return;
    if (!INDIAN_MOBILE_RE.test(phone)) {
      setError("Enter the 10-digit mobile number, without the +91.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
    setBusy(false);
    if (otpError) {
      setError("Couldn't send the code — check the number and try again.");
      return;
    }
    setCode("");
    setView("otp");
    setResendIn(RESEND_SECONDS);
  }

  const verifyOtp = useCallback(
    async (token: string) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setError(null);
      setBusy(true);
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token,
        type: "sms",
      });
      if (verifyError || !data.user) {
        setBusy(false);
        verifyingRef.current = false;
        setCode("");
        setError("That code didn't match — check the SMS and try again.");
        codeInputRef.current?.focus();
        return;
      }
      // Same redirect rules as the OAuth callback: no profile → claim a
      // handle, mid-onboarding → current step, published → dashboard.
      const destination = await postAuthDestination(supabase, data.user.id);
      router.replace(destination);
    },
    [phone, router],
  );

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
    if (digits.length === 6) void verifyOtp(digits);
  }

  return (
    <div className="text-left">
      {view === "methods" && (
        <div className="pop-in">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="btn btn-primary btn-lg w-full disabled:cursor-default disabled:opacity-70"
          >
            {busy ? (
              <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
            ) : (
              <GoogleG className="size-[17px]" />
            )}
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setView("phone");
            }}
            className="hit-44 mx-auto mt-5 flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors hover:text-ink"
          >
            No Google account? Use your phone number
            <ArrowRight className="size-[14px]" aria-hidden="true" />
          </button>
        </div>
      )}

      {view === "phone" && (
        <form
          className="pop-in"
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
        >
          <label htmlFor="auth-phone" className="mb-2 block text-[13px] font-bold text-ink-2">
            Mobile number
          </label>
          <div className="flex items-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-paper transition-colors focus-within:border-ink">
            <span className="select-none border-r border-line px-3.5 py-3 text-[15px] font-semibold text-muted">
              +91
            </span>
            <input
              ref={phoneInputRef}
              id="auth-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                setError(null);
              }}
              className="w-full bg-transparent px-3.5 py-3 text-[15.5px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-faint"
            />
          </div>

          <button
            type="submit"
            disabled={busy || phone.length !== 10}
            className="btn btn-primary btn-lg mt-4 w-full disabled:cursor-default disabled:opacity-50"
          >
            {busy && <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />}
            Send code
            {!busy && <Smartphone className="size-[16px]" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setView("methods");
            }}
            className="hit-44 mx-auto mt-5 flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-[14px]" aria-hidden="true" />
            Use Google instead
          </button>
        </form>
      )}

      {view === "otp" && (
        <form
          className="pop-in"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) void verifyOtp(code);
          }}
        >
          <label htmlFor="auth-otp" className="mb-2 block text-[13px] font-bold text-ink-2">
            Enter the 6-digit code sent to +91 {phone}
          </label>
          <div className="relative">
            <input
              ref={codeInputRef}
              id="auth-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              disabled={busy}
              className="field text-center text-[24px] font-bold tracking-[0.45em] disabled:opacity-60"
            />
            {busy && (
              <LoaderCircle
                className="absolute right-4 top-1/2 size-[18px] -translate-y-1/2 animate-spin text-muted"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-[13.5px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCode("");
                setView("phone");
              }}
              className="hit-44 flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-[13px]" aria-hidden="true" />
              Edit number
            </button>
            {resendIn > 0 ? (
              <span className="text-faint">Resend in {resendIn}s</span>
            ) : (
              <button
                type="button"
                onClick={() => void sendOtp()}
                disabled={busy}
                className="hit-44 text-terra-deep transition-colors hover:text-terra disabled:opacity-50"
              >
                Resend code
              </button>
            )}
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="shake mt-4 text-center text-[13.5px] font-semibold text-[oklch(50%_0.17_25)]">
          {error}
        </p>
      )}
    </div>
  );
}
