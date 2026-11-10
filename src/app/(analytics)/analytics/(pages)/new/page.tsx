import { redirect } from "next/navigation";
import { lookupWorkspace } from "@/lib/analytics/workspace";
import { OnboardingForm } from "../../OnboardingForm";

// Platform admins can run more than one business (e.g. their own units and
// a client's). Everyone else gets one business per licence.
export default async function NewBusinessPage() {
  const ws = await lookupWorkspace();
  if (ws.status === "signed_out") redirect("/login");
  if (ws.status === "no_workspace") redirect("/analytics");
  if (ws.status !== "ok" || !ws.isPlatformAdmin) redirect("/analytics");
  return (
    <div className="panel">
      <h1>Add a business</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        A separate dashboard with its own uploads, units, expenses and team. Switch between businesses from the top bar.
      </p>
      <OnboardingForm />
    </div>
  );
}
