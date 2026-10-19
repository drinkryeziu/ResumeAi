"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Copies the document as plain text so it can be pasted into an application form. */
export function CopyTextButton({ text, className, variant = "secondary" }: { text: string; className?: string; variant?: "secondary" | "link" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // Clipboard API unavailable (older browser or insecure context): fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      setState(ok ? "copied" : "failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        compact={variant === "secondary"}
        className={className}
        onClick={copy}
        icon={variant === "link" ? undefined : state === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      >
        {state === "copied" ? "Copied" : "Copy as text"}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied to the clipboard." : state === "failed" ? "Could not copy. Select the text in the preview and copy it instead." : ""}
      </span>
    </>
  );
}
