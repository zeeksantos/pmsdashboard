import { redirect } from "next/navigation";

// "My Account" is now Settings; keep old bookmarks working.
export default function AccountRedirect() {
  redirect("/settings");
}
