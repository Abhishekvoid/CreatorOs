import { LogoMark } from "../ui";

export default function ProfileFooter() {
  return (
    <footer className="border-t border-line bg-paper py-7">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-6 max-md:flex-col">
        <p className="text-[13px] font-semibold text-faint">© 2026 Meera Shah · All sessions are confidential</p>
        <a
          href="/"
          className="group/logo flex items-center gap-2.5 rounded-full border border-line bg-cream py-2 pl-3 pr-4.5 text-[13.5px] font-bold text-ink-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-terra hover:shadow-soft"
        >
          <LogoMark className="size-[24px] rounded-[8px]" />
          <span>
            Powered by Creator<span className="font-medium text-muted">OS</span>
            <span className="ml-2 font-semibold text-terra-deep">Claim your own link →</span>
          </span>
        </a>
        <div className="flex gap-5">
          {["Privacy", "Terms", "Refunds"].map((l) => (
            <a key={l} href="#" className="text-[13px] font-semibold text-muted transition-colors hover:text-ink">
              {l}
            </a>
          ))}
        </div>
      </div>
      {/* breathing room so the sticky mobile CTA never covers footer content */}
      <div className="h-16 md:hidden" aria-hidden="true" />
    </footer>
  );
}
