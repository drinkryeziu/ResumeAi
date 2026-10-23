"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronDown, Coins, LogOut, Settings, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/layout/PublicHeader";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/** The three places people go: jobs and applications are opened from the Dashboard, every resume and cover letter lives under Documents. Credits and settings live in the account menu; "Sign out" is a plain text link in the bar. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", match: ["/dashboard", "/jobs", "/master"] },
  { href: "/documents", label: "Documents", match: ["/documents"] },
  { href: "/profile", label: "Professional profile", match: ["/profile", "/onboarding"] },
] as const;

const isActive = (pathname: string, match: readonly string[], fromDocuments = false, href = "") => {
  // A document opened from the Documents tab keeps that tab lit, even though it lives under /jobs.
  if (fromDocuments && (pathname.startsWith("/jobs") || pathname.startsWith("/master"))) return href === "/documents";
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
};

/**
 * Design-system SiteHeader: 60px white bar, shadow-header, wordmark left, plain body-sm links right.
 * No filled button in the bar (design-system rule); the account menu opens a sky-50 panel.
 * `setup` (first-time users who have no profile yet) drops the nav, since every page just sends them back to setup:
 * only the wordmark and Sign out remain.
 */
export function SiteHeader({ creditBalance, name, email, setup = false, admin = false }: { creditBalance: number; name: string; email: string; setup?: boolean; admin?: boolean }) {
  const pathname = usePathname();
  const fromDocuments = useSearchParams().get("from") === "documents";
  if (setup) {
    return (
      <header className="sticky top-0 z-20 bg-[#fbf8ff]/90 shadow-header backdrop-blur-md">
        <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between px-ds-4 md:px-ds-5">
          <Wordmark href="/onboarding" />
          <div className="flex items-center gap-ds-4">
            <span className="hidden text-body-sm sm:inline">Setting up {email}</span>
            <SignOutLink />
          </div>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-20 bg-[#fbf8ff]/90 shadow-header backdrop-blur-md">
      <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between px-ds-4 md:px-ds-5">
        <Wordmark href="/dashboard" />
        <nav aria-label="Main" className="hidden items-center gap-ds-5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.match, fromDocuments, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-[19px] text-body-sm no-underline hover:text-blue-600",
                  active ? "font-bold text-blue-600 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t after:bg-blue-600" : "text-navy-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <AccountMenu creditBalance={creditBalance} name={name} email={email} admin={admin} />
          <SignOutLink />
        </nav>
        <MobileNav creditBalance={creditBalance} pathname={pathname} fromDocuments={fromDocuments} admin={admin} />
      </div>
    </header>
  );
}

/** A text link in the bar (no filled button, per the design system). Works with or without JavaScript. */
function SignOutLink() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="inline-flex items-center gap-1 text-body-sm text-navy-900 hover:text-blue-600">
        <LogOut size={16} aria-hidden="true" className="text-blue-600" /> Sign out
      </button>
    </form>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Closes on outside click and on Escape; <details> keeps it keyboard-operable without extra state. */
function useDismissible() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.open = false; // close after navigating
    const onClick = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [pathname]);
  return ref;
}

function AccountMenu({ creditBalance, name, email, admin }: { creditBalance: number; name: string; email: string; admin: boolean }) {
  const ref = useDismissible();
  return (
    <details ref={ref} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-ds-3 rounded-pill py-1 pr-2 pl-1 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-sky-50 text-label-bold text-blue-700">
          {initials(name)}
        </span>
        <span className="flex items-center gap-1 text-label-bold">
          <Coins size={16} aria-hidden="true" className="text-blue-600" />
          {formatNumber(creditBalance)}
          <span className="sr-only"> credits. Account menu</span>
        </span>
        <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 mt-ds-2 flex w-64 flex-col rounded-md bg-sky-50 p-ds-2 shadow-card">
        <div className="px-ds-3 py-ds-2">
          <p className="text-label-bold">{name}</p>
          <p className="text-caption truncate">{email}</p>
        </div>
        <Link href="/credits" className="flex items-center justify-between rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white">
          <span className="flex items-center gap-ds-2">
            <Coins size={16} aria-hidden="true" className="text-blue-600" /> Credits
          </span>
          <span className="text-label-bold">{formatNumber(creditBalance)}</span>
        </Link>
        <Link href="/settings" className="flex items-center gap-ds-2 rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white">
          <Settings size={16} aria-hidden="true" className="text-blue-600" /> Settings
        </Link>
        {admin && (
          <Link href="/admin" className="flex items-center gap-ds-2 rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white">
            <ShieldCheck size={16} aria-hidden="true" className="text-blue-600" /> Admin dashboard
          </Link>
        )}
      </div>
    </details>
  );
}

/** Below md: logo + menu; the open menu is a sky-50 panel, per the design system. */
function MobileNav({ creditBalance, pathname, fromDocuments, admin }: { creditBalance: number; pathname: string; fromDocuments: boolean; admin: boolean }) {
  const ref = useDismissible();
  return (
    <details ref={ref} className="relative md:hidden">
      <summary className="cursor-pointer list-none rounded-pill px-ds-3 py-ds-2 text-label-bold hover:bg-gray-100 [&::-webkit-details-marker]:hidden">Menu</summary>
      <nav aria-label="Main" className="absolute right-0 mt-ds-2 flex w-60 flex-col rounded-md bg-sky-50 p-ds-2 shadow-card">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.match, fromDocuments, item.href) ? "page" : undefined}
            className={cn("rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white", isActive(pathname, item.match, fromDocuments, item.href) && "font-bold text-blue-700")}
          >
            {item.label}
          </Link>
        ))}
        <span className="my-ds-1 h-px bg-white" aria-hidden="true" />
        <Link href="/credits" className="flex justify-between rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white">
          Credits <span className="text-label-bold">{formatNumber(creditBalance)}</span>
        </Link>
        <Link href="/settings" className="rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white">
          Settings
        </Link>
        {admin && (
          <Link href="/admin" className="rounded-sm px-ds-3 py-ds-2 text-body-sm no-underline hover:bg-white">
            Admin dashboard
          </Link>
        )}
        <form action={signOutAction}>
          <button type="submit" className="w-full rounded-sm px-ds-3 py-ds-2 text-left text-body-sm hover:bg-white">
            Sign out
          </button>
        </form>
      </nav>
    </details>
  );
}
