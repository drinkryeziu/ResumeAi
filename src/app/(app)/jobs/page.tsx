import { redirect } from "next/navigation";

/** The add-a-job form lives on the dashboard; this keeps old links working. */
export default function JobsPage() {
  redirect("/dashboard#tailor");
}
