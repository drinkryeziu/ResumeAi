import { NextResponse } from "next/server";
import { currentUserId } from "@/server/auth/session";
import { overLimit, RULES } from "@/server/security/rate-limit";
import { exportAccountData } from "@/server/services/account";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const maxDuration = 30;

/** "Download my data": one JSON file with everything held about the signed-in person. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to download your data." }, { status: 401 });
  const store = await getStore();
  if (await overLimit(store, RULES.exportUser, userId)) return NextResponse.json({ error: "Too many downloads. Please wait a while and try again." }, { status: 429 });
  const data = await exportAccountData(store, userId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="krz-resume-ai-my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
