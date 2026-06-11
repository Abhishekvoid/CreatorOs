export default function CheckoutNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-100 border-b border-line bg-cream/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between gap-3 px-6">
        <a
          href="/meera"
          className="group flex min-w-0 items-center gap-2 text-[14px] font-bold text-ink-2 transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 transition-transform duration-300 ease-soft group-hover:-translate-x-0.5"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="truncate">
            <span className="text-faint">creatoros.in/</span>meera
          </span>
        </a>

        <div className="flex items-center gap-2 text-[12.5px] font-bold text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 text-green"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Secure checkout
          <span className="max-sm:hidden">
            · powered by <b className="text-ink">Razorpay</b>
          </span>
        </div>
      </div>
    </header>
  );
}
