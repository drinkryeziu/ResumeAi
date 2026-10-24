import { redirect } from "next/navigation";

/** The "your documents are ready" page is gone: a new profile now lands on /profile with a notice. Old links go there. */
export default function OnboardingDonePage() {
  redirect("/profile");
}
