import { redirect } from "next/navigation";

/** The Master documents are no longer shown (they work behind the scenes); old links and bookmarks land on the profile. */
export default function MasterPage() {
  redirect("/profile");
}
