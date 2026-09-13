import { redirect } from "next/navigation";
import { getAdminAccess } from "./admin-auth";
import { AdminLoginPage } from "./admin-login-page";
import { V4WorkspaceGate } from "./v4-workspace-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "KCPL Operations", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (access.kind === "unconfigured") {
    return <AdminGate
      title="Firebase admin access needs configuration"
      detail="Configure the Firebase project in App Hosting, then create the initial staff account in Firebase Authentication. KCPL_ADMIN_EMAILS can be used as the bootstrap management allowlist."
    />;
  }

  if (access.kind === "signed-out") return <AdminLoginPage />;

  redirect("/admin/command-centre");
}

function AdminGate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Operations"
    title={title}
    detail={detail}
    actions={[{ href: "/", label: "Public website", primary: true }]}
  />;
}
