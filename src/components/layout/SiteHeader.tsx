"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "My Profile" },
  { href: "/jobs", label: "Jobs" },
  { href: "/resumes", label: "My Resumes" },
  { href: "/documents", label: "Documents" },
  { href: "/credits", label: "Credits" },
  { href: "/settings", label: "Settings" },
] as const;

/**
 * Design-system SiteHeader: 60px white bar, shadow-header, wordmark left, plain body-sm links right.
 * The credit balance is a text link — the system forbids a filled CTA in the bar.
 */
export function SiteHeader({ creditBalance }: { creditBalance: number }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between bg-white px-ds-4 py-ds-2 shadow-header md:px-ds-5">
      <Link href="/dashboard" className="text-[20px] leading-none font-bold tracking-[-0.3px] text-blue-700 no-underline">
        ApplyAI
      </Link>
      <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("text-body-sm no-underline hover:text-blue-600", active ? "font-bold text-blue-600" : "text-navy-900")}
            >
              {item.label}
            </Link>
          );
        })}
        <Link href="/credits" className="flex items-center gap-1 text-label-bold text-navy-900 no-underline hover:text-blue-600">
          <Coins size={16} aria-hidden="true" className="text-blue-600" />
          {formatNumber(creditBalance)} credits
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="inline-flex items-center gap-1 text-body-sm text-navy-900 hover:text-blue-600">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </form>
      </nav>
      <MobileNav creditBalance={creditBalance} />
    </header>
  );
}

/** Below lg: logo + menu; the open menu is a sky-50 panel, per the design system. */
function MobileNav({ creditBalance }: { creditBalance: number }) {
  return (
    <details className="relative lg:hidden">
      <summary className="cursor-pointer list-none text-label-bold">Menu</summary>
      <nav aria-label="Main" className="absolute right-0 mt-ds-3 flex w-56 flex-col gap-ds-3 rounded-md bg-sky-50 p-ds-4 shadow-card">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="text-body-sm no-underline">
            {item.label}
          </Link>
        ))}
        <span className="text-label-bold">{formatNumber(creditBalance)} credits</span>
        <form action={signOutAction}>
          <button type="submit" className="text-body-sm underline">
            Sign out
          </button>
        </form>
      </nav>
    </details>
  );
}
