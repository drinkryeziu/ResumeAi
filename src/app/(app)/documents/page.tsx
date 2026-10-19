import { redirect } from "next/navigation";

/** There is no Documents tab: master documents and each application are opened from the dashboard. Old links land there. */
export default function DocumentsPage() {
  redirect("/dashboard");
}
