import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-sm bg-gray-100 px-ds-2 py-2.5 text-body text-navy-900 placeholder:text-gray-500 outline-none focus-visible:outline-2 focus-visible:outline-blue-600 aria-invalid:shadow-[inset_0_0_0_2px_var(--color-danger)]";

/**
 * `error` renders under the control; the control itself must set `aria-invalid` and
 * `aria-describedby={`${htmlFor}-error`}` (see `errorProps`).
 */
export function Field({
  label,
  hint,
  required,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label htmlFor={htmlFor} className="text-label-bold">
        {label}
        {required ? <span aria-hidden="true"> *</span> : <span className="text-caption font-normal"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-caption">{hint}</p>
      )}
    </div>
  );
}

/** Props that tie an input to its Field error message. */
export const errorProps = (id: string, error?: string) => (error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cn(control, "appearance-auto", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-56 resize-y", className)} {...rest} />;
}
