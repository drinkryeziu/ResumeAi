import Link from "next/link";

/** The ResumeAi mark and name, shared by the signed-out and signed-in headers. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-[22px] leading-none font-bold tracking-[-0.3px] text-navy-900 no-underline">
      <span aria-hidden="true" className="au-grad grid size-9 place-items-center rounded-[12px]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      </span>
      ResumeAi
    </Link>
  );
}

/** Signed-out header: the mark, text links and a gradient "Get started" pill. */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 flex min-h-[68px] flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-[#fbf8ff]/90 px-ds-4 py-2 shadow-header backdrop-blur-md md:px-ds-5">
      <Wordmark />
      <nav aria-label="Account" className="flex items-center gap-4 sm:gap-6">
        <Link href="/#how-it-works" className="hidden text-body-sm no-underline hover:text-blue-600 sm:inline">
          How it works
        </Link>
        <Link href="/#pricing" className="hidden text-body-sm no-underline hover:text-blue-600 sm:inline">
          Pricing
        </Link>
        <Link href="/sign-in" className="text-body-sm no-underline hover:text-blue-600">
          Sign in
        </Link>
        <Link href="/sign-up" className="au-grad rounded-pill px-4 py-2.5 text-label-bold text-white no-underline hover:brightness-110 sm:px-5">
          Get started
        </Link>
      </nav>
    </header>
  );
}
