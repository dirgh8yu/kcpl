"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { OpsButton } from "./operations-ui";
import { V4WorkspaceGate } from "./v4-workspace-gate";

// Operations routes degrade into gates for missing data, so a thrown render error must land in the
// same vocabulary — a branded, recoverable state — rather than Next's default error screen.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("KCPL operations route failed to render", error);
  }, [error]);

  return <V4WorkspaceGate
    eyebrow="KCPL Operations"
    title="This workspace could not be loaded"
    detail="The operations route failed before it finished rendering. Nothing was saved by this request. Retry the workspace, or return to the operations overview and open it again."
    actions={[
      { href: "/admin/command-centre", label: "Operations Overview", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  >
    <OpsButton variant="secondary" size="md" onClick={reset}><RefreshCw size={13}/>Retry this workspace</OpsButton>
  </V4WorkspaceGate>;
}
