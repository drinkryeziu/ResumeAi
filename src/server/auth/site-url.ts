import "server-only";
import { headers } from "next/headers";

/** The address people use to reach the site, for links in emails. AUTH_URL wins when set; otherwise it comes from the request. */
export async function siteUrl(): Promise<string> {
  const fixed = process.env.AUTH_URL?.trim();
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
