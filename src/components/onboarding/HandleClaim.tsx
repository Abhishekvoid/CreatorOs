"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { HANDLE_MIN, RESERVED_HANDLES, sanitizeHandle } from "@/lib/auth";
import { checkHandle, claimHandle, type HandleStatus } from "@/app/onboarding/handle/actions";

type Status = "idle" | "checking" | HandleStatus;

const ERROR_COPY: Record<string, string> = {
  taken: "Just taken — try another",
  reserved: "That one's reserved — try another",
  invalid: "Handles use a–z, 0–9 and _ only",
  config: "Supabase keys aren't set yet — add them to .env.local",
  error: "Something went wrong — try again",
};

export default function HandleClaim() {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Monotonic counter so a slow availability response can never
  // overwrite the state of a newer keystroke.
  const checkSeq = useRef(0);

  // Debounced server check — synchronous transitions happen in onInput.
  useEffect(() => {
    if (handle.length < HANDLE_MIN || RESERVED_HANDLES.has(handle)) return;
    const seq = checkSeq.current;
    const t = setTimeout(async () => {
      const result = await checkHandle(handle);
      if (checkSeq.current === seq) setStatus(result);
    }, 300);
    return () => clearTimeout(t);
  }, [handle]);

  function onInput(raw: string) {
    const next = sanitizeHandle(raw);
    checkSeq.current++; // invalidate any in-flight availability response
    setClaimError(null);
    setHandle(next);
    if (next.length < HANDLE_MIN) setStatus("idle");
    else if (RESERVED_HANDLES.has(next)) setStatus("reserved");
    else setStatus("checking");
  }

  async function onClaim() {
    if (status !== "available" || claiming) return;
    setClaiming(true);
    setClaimError(null);
    // On success the action redirects to /onboarding/profile, which
    // resolves without a value — only failures carry an error.
    const result = await claimHandle(handle);
    if (!result) return; // redirect in flight; keep the button in its loading state
    setClaiming(false);
    setClaimError(ERROR_COPY[result.error]);
    setStatus(result.error === "taken" ? "taken" : "idle");
  }

  const showUrl = handle.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onClaim();
      }}
      className="mx-auto w-full max-w-[480px]"
    >
      <div
        className={`flex items-center rounded-[18px] border-[1.5px] bg-paper pr-4 transition-colors focus-within:border-ink ${
          claimError ? "border-[oklch(60%_0.15_25)]" : "border-line"
        }`}
      >
        <label
          htmlFor="handle"
          className="select-none whitespace-nowrap py-4 pl-5 text-[17px] font-semibold text-muted"
        >
          creatoros.in/
        </label>
        <input
          id="handle"
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="yourname"
          value={handle}
          onChange={(e) => onInput(e.target.value)}
          aria-describedby="handle-status"
          className="w-full bg-transparent py-4 pr-2 text-[17px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-faint"
        />
        <span id="handle-status" className="flex shrink-0 items-center" aria-live="polite">
          {status === "available" && (
            <span className="pop-in grid size-6 place-items-center rounded-full bg-green-soft">
              <Check className="size-[14px] text-green-deep" strokeWidth={3} aria-label="Available" />
            </span>
          )}
          {status === "taken" && (
            <span className="pop-in text-[13px] font-bold text-[oklch(50%_0.17_25)]">taken</span>
          )}
          {status === "reserved" && (
            <span className="pop-in text-[13px] font-bold text-[oklch(50%_0.17_25)]">reserved</span>
          )}
        </span>
      </div>

      {/* the URL forming in real time — fixed height so the screen never jumps */}
      <p
        className="mt-7 min-h-[44px] text-center text-[clamp(22px,4vw,30px)] font-semibold tracking-[-0.015em] text-faint"
        aria-hidden={!showUrl}
      >
        {showUrl && (
          <>
            creatoros.in/<span className="text-ink">{handle}</span>
          </>
        )}
      </p>

      <button
        type="submit"
        disabled={status !== "available" || claiming}
        className="btn btn-grad btn-lg mt-7 w-full disabled:cursor-default disabled:opacity-50"
      >
        {claiming ? (
          <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
        ) : (
          <>
            Claim my link
            <ArrowRight className="arr size-[17px]" aria-hidden="true" />
          </>
        )}
      </button>

      {claimError && (
        <p role="alert" className="shake mt-4 text-center text-[14px] font-semibold text-[oklch(50%_0.17_25)]">
          {claimError}
        </p>
      )}
    </form>
  );
}
