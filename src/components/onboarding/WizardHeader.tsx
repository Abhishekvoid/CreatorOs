import Link from "next/link";
import { LogoMark } from "@/components/ui";

const STEPS = ["Handle", "Profile", "Service", "Availability", "Payments"];

/** The shared onboarding chrome: logo plus the five-step progress trail. */
export default function WizardHeader({ current }: { current: number }) {
  return (
    <header className="border-b border-line bg-cream/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-6">
        <Link href="/" className="group/logo flex items-center gap-2.5 text-[17px] font-black tracking-tight">
          <LogoMark className="size-[30px] rounded-[10px]" />
          <span className="max-sm:hidden">
            Creator<span className="font-medium text-muted">OS</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 max-md:gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 max-md:gap-2">
              {i > 0 && <span className="h-px w-5 bg-line-2 max-md:w-2.5" />}
              <span
                className={`flex items-center gap-1.5 text-[12.5px] font-extrabold ${
                  i === current ? "text-ink" : i < current ? "text-green-deep" : "text-faint"
                }`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full text-[10.5px] ${
                    i === current
                      ? "bg-ink text-cream"
                      : i < current
                        ? "bg-green-soft text-green-deep"
                        : "border border-line-2 text-faint"
                  }`}
                >
                  {i < current ? "✓" : i + 1}
                </span>
                <span className="max-lg:hidden">{s}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
