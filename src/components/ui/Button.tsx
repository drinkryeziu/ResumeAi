import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Design-system Button: pill shape, uppercase `button` type style.
 * - primary: blue-600 fill — ONE per view (the main action).
 * - secondary: white with a 2px blue-600 ring — the second action.
 * - link: blue-700 underlined body-sm — tertiary actions.
 * `cost` appends the credit price so users always see what an AI action costs before clicking.
 */
type Variant = "primary" | "secondary" | "link";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill transition-colors disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "text-button px-7 py-ds-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400",
  secondary:
    "text-button px-7 py-ds-3 bg-white text-blue-600 shadow-[inset_0_0_0_2px_var(--blue-600)] hover:text-blue-700 hover:shadow-[inset_0_0_0_2px_var(--blue-700)] disabled:shadow-none disabled:bg-gray-100 disabled:text-gray-400",
  link: "text-body-sm text-blue-700 underline px-0 py-0",
};

type CommonProps = { variant?: Variant; cost?: number; icon?: ReactNode; className?: string; children: ReactNode };

function Content({ icon, children, cost }: Pick<CommonProps, "icon" | "children" | "cost">) {
  return (
    <>
      {icon}
      <span>{children}</span>
      {cost !== undefined && <span className="opacity-80">· {cost} credits</span>}
    </>
  );
}

export function Button({
  variant = "primary",
  cost,
  icon,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button className={cn(base, variants[variant], className)} {...rest}>
      <Content icon={icon} cost={cost}>
        {children}
      </Content>
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  cost,
  icon,
  className,
  children,
  href,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={cn(base, variants[variant], "no-underline", variant === "link" && "underline", className)}>
      <Content icon={icon} cost={cost}>
        {children}
      </Content>
    </Link>
  );
}

/** 40px gray-100 circle with shadow-card — carousel arrows and icon-only actions. */
export function IconButton({ label, children, className, ...rest }: { label: string } & ComponentProps<"button">) {
  return (
    <button
      aria-label={label}
      className={cn("inline-grid size-10 place-items-center rounded-full bg-gray-100 text-navy-900 shadow-card", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
