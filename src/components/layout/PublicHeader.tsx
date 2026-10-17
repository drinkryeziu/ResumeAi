import Link from "next/link";

/** Signed-out header. Per the design system, the bar holds text links only — no filled button. */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between bg-white px-ds-4 shadow-header md:px-ds-5">
      <Link href="/" className="text-[20px] leading-none font-bold tracking-[-0.3px] text-blue-700 no-underline">
        ResumeAi
      </Link>
      <nav aria-label="Account" className="flex items-center gap-6">
        <Link href="/#how-it-works" className="hidden text-body-sm no-underline hover:text-blue-600 sm:inline">
          How it works
        </Link>
        <Link href="/#pricing" className="hidden text-body-sm no-underline hover:text-blue-600 sm:inline">
          Pricing
        </Link>
        <Link href="/sign-in" className="text-body-sm no-underline hover:text-blue-600">
          Sign in
        </Link>
        <Link href="/sign-up" className="text-label-bold text-blue-700 no-underline hover:text-blue-600">
          Get started
        </Link>
      </nav>
    </header>
  );
}
