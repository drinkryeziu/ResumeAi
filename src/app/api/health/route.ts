import { NextResponse } from "next/server";
import { setupStatus } from "@/server/store/setup-check";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Open /api/health on a deployed site to see whether it is set up: which required settings it can see
 * (yes or no, never the values) and whether the database answers. 200 when ready, 503 when not.
 */
export async function GET() {
  const status = await setupStatus();
  return NextResponse.json(status, { status: status.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
