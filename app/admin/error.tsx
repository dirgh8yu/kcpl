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
    title="This page didn’t load"
    detail="Something went wrong while opening it. Nothing was changed. Try again, or go back to the Overview."
    actions={[{ href: "/admin/command-centre", label: "Overview" }]}
  >
    <OpsButton variant="primary" size="md" onClick={reset}><RefreshCw size={13}/>Try again</OpsButton>
  </V4WorkspaceGate>;
}
