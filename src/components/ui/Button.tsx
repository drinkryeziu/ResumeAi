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
    "text-button py-ds-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400",
  secondary:
    "text-button py-ds-3 bg-white text-blue-600 shadow-[inset_0_0_0_2px_var(--blue-600)] hover:text-blue-700 hover:shadow-[inset_0_0_0_2px_var(--blue-700)] disabled:shadow-none disabled:bg-gray-100 disabled:text-gray-400",
  link: "text-body-sm text-blue-700 underline px-0 py-0",
};

type CommonProps = { variant?: Variant; cost?: number; icon?: ReactNode; compact?: boolean; className?: string; "aria-label"?: string; children: ReactNode };

/** Horizontal padding for the filled/outlined pills; `compact` is for rows of three or more buttons. */
const pad = (variant: Variant, compact?: boolean) => (variant === "link" ? "" : compact ? "px-5" : "px-7");

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
  compact,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button className={cn(base, variants[variant], pad(variant, compact), className)} {...rest}>
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
  compact,
  className,
  children,
  href,
  "aria-label": ariaLabel,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} aria-label={ariaLabel} className={cn(base, variants[variant], pad(variant, compact), "no-underline", variant === "link" && "underline", className)}>
      <Content icon={icon} cost={cost}>
        {children}
      </Content>
    </Link>
  );
}

/** A plain <a> that looks like a button — for file downloads, which must not go through client-side routing. */
export function ButtonAnchor({
  variant = "primary",
  icon,
  compact,
  className,
  children,
  href,
  "aria-label": ariaLabel,
}: Omit<CommonProps, "cost"> & { href: string }) {
  return (
    <a href={href} aria-label={ariaLabel} className={cn(base, variants[variant], pad(variant, compact), "no-underline", className)}>
      <Content icon={icon}>{children}</Content>
    </a>
  );
}

/**
 * 40px gray-100 circle with shadow-card — carousel arrows and icon-only actions. The icon is ink at rest and takes the
 * action's color on hover, focus and press: blue for ordinary actions, red for ones that delete.
 */
type IconTone = "blue" | "danger";
const ICON_TONE: Record<IconTone, string> = {
  blue: "hover:bg-sky-50 hover:text-blue-600 focus-visible:text-blue-600 active:bg-sky-50 active:text-blue-700",
  danger: "hover:bg-danger-tint hover:text-danger focus-visible:text-danger active:bg-danger-tint active:text-danger",
};
const iconClass = (tone?: IconTone, className?: string) =>
  cn(
    "inline-grid size-10 shrink-0 place-items-center rounded-full bg-gray-100 text-navy-900 shadow-card no-underline transition-colors focus-visible:outline-2 focus-visible:outline-blue-600",
    tone && ICON_TONE[tone],
    className,
  );

export function IconButton({ label, children, className, tone, ...rest }: { label: string; tone?: IconTone } & ComponentProps<"button">) {
  return (
    <button aria-label={label} title={label} className={iconClass(tone, className)} {...rest}>
      {children}
    </button>
  );
}

/** The same round icon button, as a link. */
export function IconLink({ label, href, children, className, tone }: { label: string; href: string; children: ReactNode; className?: string; tone?: IconTone }) {
  return (
    <Link href={href} aria-label={label} title={label} className={iconClass(tone, className)}>
      {children}
    </Link>
  );
}
