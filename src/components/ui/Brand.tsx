import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The product's name, "KRZResumeBuilder", as it is shown to people.
 *
 * - `display` (the logo, a title, a heading): KRZ in black type (weight 900), ResumeBuilder in light type (weight 300).
 * - `text` (inside a sentence): KRZ is always weight 900, ResumeBuilder keeps the weight of the text around it.
 *
 * Colour: KRZ in a lighter blue and ResumeBuilder in a darker blue, both chosen to pass AA contrast (4.5:1) on white and on every
 * light tint the app uses. On a dark or gradient background pass `onDark`: both parts are white.
 * Anywhere that cannot carry markup (page titles, emails, file names) the name is plain text, "KRZResumeBuilder".
 */
export function Brand({ variant = "display", onDark = false, className }: { variant?: "display" | "text"; onDark?: boolean; className?: string }) {
  return (
    <span className={className}>
      <span className={cn("font-black", onDark ? "text-white" : "text-[#2a5bd7]")}>KRZ</span>
      <span className={cn(variant === "display" && "font-light", onDark ? "text-white" : "text-[#172554]")}>ResumeBuilder</span>
    </span>
  );
}

const NAME = "KRZResumeBuilder";

/** A piece of text with the name in it: the name is shown as `Brand` (text style), the rest is left as it is. Anything that is not a string passes through. */
export function BrandText({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  if (typeof children !== "string" || !children.includes(NAME)) return <>{children}</>;
  const parts = children.split(NAME);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <Brand variant="text" onDark={onDark} />}
        </span>
      ))}
    </>
  );
}
