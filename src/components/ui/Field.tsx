import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-sm bg-gray-100 px-ds-2 py-2.5 text-body text-navy-900 placeholder:text-gray-500 outline-none focus-visible:outline-2 focus-visible:outline-blue-600";

export function Field({ label, hint, required, children, htmlFor }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label htmlFor={htmlFor} className="text-label-bold">
        {label}
        {required ? <span aria-hidden="true"> *</span> : <span className="text-caption font-normal"> (optional)</span>}
      </label>
      {children}
      {hint && <p className="text-caption">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-56 resize-y", className)} {...rest} />;
}
