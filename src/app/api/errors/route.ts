import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { recordError } from "@/server/admin/record-error";
import { currentUserId } from "@/server/auth/session";
import { ipFrom, overLimit, RULES } from "@/server/security/rate-limit";
import { getStore } from "@/server/store";

export const runtime = "nodejs";

const Report = z.object({
  message: z.string().max(1000),
  path: z.string().max(300).optional(),
  digest: z.string().max(80).optional(),
  name: z.string().max(80).optional(),
});

/**
 * A page crashed in someone's browser: the error screen sends what happened (no query string, no page content) so it shows up in
 * the admin dashboard's error log. Open to signed-out visitors too, so it is limited per address and always answers 204.
 */
export async function POST(req: NextRequest) {
  const store = await getStore();
  if (await overLimit(store, RULES.errorReportIp, ipFrom(req.headers))) return new NextResponse(null, { status: 204 });
  const body = Report.safeParse(await req.json().catch(() => null));
  if (!body.success) return new NextResponse(null, { status: 204 });
  const { message, path, digest, name } = body.data;
  await recordError(store, {
    source: "page",
    code: digest ? "server_render" : "browser",
    message: `${name ? `${name}: ` : ""}${message}${digest ? ` (code ${digest})` : ""}`,
    userId: await currentUserId(),
    path,
  });
  return new NextResponse(null, { status: 204 });
}
