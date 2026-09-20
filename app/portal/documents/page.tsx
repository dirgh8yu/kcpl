import { FileText } from "lucide-react";
import { getPortalAccess } from "../portal-auth";
import { listPortalDocuments } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalDocumentsWorkspace } from "./portal-documents-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalDocumentsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await listPortalDocuments(access.session);
  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready"
        ? <PortalDocumentsWorkspace documents={result.documents} scanned={result.scanned} total={result.total}/>
        : <PortalWorkspaceUnavailable eyebrow="Kapileshwor Cargo" title="Documents" icon={<FileText size={18}/>}/>}
    </PortalShell>
  );
}
