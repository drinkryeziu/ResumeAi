import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { recordError } from "@/server/admin/record-error";
import { currentUserId } from "@/server/auth/session";
import { exportCoverLetter, exportPackage, exportResume, fileBase, MIME } from "@/server/documents/export";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const maxDuration = 30; // building a PDF or Word file

const Query = z.object({ doc: z.enum(["resume", "cover-letter", "package"]), format: z.enum(["pdf", "docx"]).default("pdf") });

/**
 * Streams the current version of a resume / cover letter, or both as a ZIP. Owner-scoped.
 * jobId "master" = the user's Master Resume and Master Cover Letter.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId: raw } = await params;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to download." }, { status: 401 });
  const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const store = await getStore();
  const jobId = raw === "master" ? null : raw;
  const job = jobId ? await store.getJob(userId, jobId) : null;
  if (jobId && !job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [resume, letter, profile] = await Promise.all([store.resumeForJob(userId, jobId), store.coverLetterForJob(userId, jobId), store.findProfile(userId)]);
  if (!profile) return NextResponse.json({ error: "Create your profile first" }, { status: 409 });
  const resumeDoc = resume?.versions.find((v) => v.id === resume.currentVersionId)?.content;
  const letterDoc = letter?.versions.find((v) => v.id === letter.currentVersionId)?.content ?? null;
  const base = fileBase(profile.firstName, profile.lastName, job ? job.company : "Master");

  let body: Buffer;
  let name: string;
  let type: string;
  try {
    if (q.data.doc === "package") {
      if (!resumeDoc) return NextResponse.json({ error: "Create your resume first" }, { status: 409 });
      body = await exportPackage(resumeDoc, letterDoc, base);
      name = `${base}-Application.zip`;
      type = MIME.zip;
    } else if (q.data.doc === "resume") {
      if (!resumeDoc) return NextResponse.json({ error: "Create your resume first" }, { status: 409 });
      body = await exportResume(resumeDoc, q.data.format);
      name = `${base}-Resume.${q.data.format}`;
      type = MIME[q.data.format];
    } else {
      if (!letterDoc) return NextResponse.json({ error: "Write your cover letter first" }, { status: 409 });
      body = await exportCoverLetter(letterDoc, q.data.format);
      name = `${base}-Cover-Letter.${q.data.format}`;
      type = MIME[q.data.format];
    }
  } catch (e) {
    // Building a file failed (not something the person did): say so plainly and keep the reason for the admin dashboard's error log.
    console.error("[download]", e);
    await recordError(store, {
      source: "download",
      code: `${q.data.doc}_${q.data.format}`,
      message: e instanceof Error ? `${e.name}: ${e.message}` : "Unknown error",
      userId,
    });
    return NextResponse.json({ error: "We couldn't build that file. Nothing was lost; try again, or download the Word version." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(body), {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
