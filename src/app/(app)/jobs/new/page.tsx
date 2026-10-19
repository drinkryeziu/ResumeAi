import { redirect } from "next/navigation";

/** The add-a-job form now lives at the top of the Jobs tab; this keeps old links working. */
export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  redirect((await searchParams).sample === "1" ? "/jobs?sample=1" : "/jobs");
}
