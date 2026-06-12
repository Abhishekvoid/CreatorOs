import Link from "next/link";
import { LogoMark } from "@/components/ui";
import AuthCard from "./AuthCard";

/**
 * Shared signup/login screen. Per spec the two pages are identical except
 * for the headline; the cross-link at the foot swaps direction.
 */
export default function AuthScreen({
  mode,
  initialError,
}: {
  mode: "signup" | "login";
  initialError?: string;
}) {
  return (
    <main data-register="product" className="grid min-h-screen place-items-center px-6 py-14">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[22px] border border-line bg-paper px-7 py-9 sm:px-9">
          <Link href="/" className="group/logo mb-7 flex items-center gap-2.5" aria-label="CreatorOS home">
            <LogoMark className="size-[30px] rounded-[10px]" />
            <span className="text-[16px] font-black tracking-tight">
              Creator<span className="font-medium text-muted">OS</span>
            </span>
          </Link>

          <h1 className="mb-7 text-[clamp(26px,4vw,31px)] font-black leading-[1.12] tracking-[-0.02em]">
            {mode === "signup" ? (
              <>
                Your link,{" "}
                <span className="font-serif italic font-normal text-grad">your business.</span>
              </>
            ) : (
              <>
                Welcome back to{" "}
                <span className="font-serif italic font-normal text-grad">your business.</span>
              </>
            )}
          </h1>

          <AuthCard initialError={initialError} />
        </div>

        <p className="mt-6 text-center text-[14px] font-medium text-muted">
          {mode === "signup" ? (
            <>
              Already have a link?{" "}
              <Link href="/login" className="font-bold text-ink underline-offset-4 hover:underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              New to CreatorOS?{" "}
              <Link href="/signup" className="font-bold text-ink underline-offset-4 hover:underline">
                Claim your link
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
