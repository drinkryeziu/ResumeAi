import { redirect } from "next/navigation";

/** The add-a-job form now lives on the dashboard; this keeps old links working. */
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  redirect((await searchParams).sample === "1" ? "/dashboard?sample=1#tailor" : "/dashboard#tailor");
}
