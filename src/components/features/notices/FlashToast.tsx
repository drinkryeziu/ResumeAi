"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { noticeMessage, withoutNotice } from "@/lib/notices";
import { useToast } from "@/components/ui/Toast";

/** After a save that ended in a redirect: show its confirmation once, then take `?notice=` out of the address. */
export function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const toast = useToast();
  const key = params.get("notice");
  useEffect(() => {
    const message = noticeMessage(key);
    if (!key) return;
    if (message) toast(message);
    // Next.js folds a plain history.replaceState into its own router state, so this only tidies the address and costs no server request.
    // A moment later, so it lands after Next has finished writing the address of the redirect it just followed.
    const search = params.toString();
    const t = setTimeout(() => window.history.replaceState(window.history.state, "", withoutNotice(pathname, search, window.location.hash)), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
