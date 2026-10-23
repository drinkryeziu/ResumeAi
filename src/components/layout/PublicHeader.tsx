import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Signed-out header. Per the design system, the bar holds text links only — no filled button.
 * The first page ("aurora") is the one exception: its "Get started" is a gradient pill, as in the approved design.
 */
export function PublicHeader({ aurora }: { aurora?: boolean }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between px-ds-4 md:px-ds-5",
        aurora ? "min-h-[68px] flex-wrap gap-x-4 gap-y-2 border-b border-[#e6defa] bg-[#fbf8ff]/90 py-2 backdrop-blur-md" : "h-[60px] bg-white shadow-header",
      )}
    >
      <Link
        href="/"
        className={cn(
          "font-bold tracking-[-0.3px] no-underline",
          aurora ? "flex items-center gap-2.5 text-[22px] leading-none text-navy-900" : "text-[20px] leading-none text-blue-700",
        )}
      >
        {aurora && (
          <span aria-hidden="true" className="au-grad grid size-9 place-items-center rounded-[12px]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </span>
        )}
        ResumeAi
      </Link>
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
        <Link
          href="/sign-up"
          className={cn(
            "no-underline",
            aurora ? "au-grad rounded-pill px-4 py-2.5 sm:px-5 text-label-bold text-white hover:brightness-110" : "text-label-bold text-blue-700 hover:text-blue-600",
          )}
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}
