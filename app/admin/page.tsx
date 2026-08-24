import { redirect } from "next/navigation";
import { getAdminAccess } from "./admin-auth";
import { loginHref, safeAdminNext } from "./admin-entry";
import { V4WorkspaceGate } from "./v4-workspace-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "KCPL Operations", robots: { index: false, follow: false } };

export default async function AdminEntryPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeAdminNext(next);
  const access = await getAdminAccess();

  if (access.kind === "unconfigured") {
    return <V4WorkspaceGate
      eyebrow="System gate"
      title="Firebase admin access needs configuration"
      detail="KCPL Operations cannot start until Firebase App Hosting and the initial authorised staff identity are configured."
      actions={[{ href: "/", label: "Return to website", primary: true }]}
    />;
  }
  if (access.kind === "signed-out") redirect(loginHref(target));
  redirect(target);
}
