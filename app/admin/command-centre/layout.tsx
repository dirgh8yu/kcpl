import type { ReactNode } from "react";

// Alert generation is owned by the authenticated refresh action and internal
// automation endpoint. Rendering a workspace must not scan and write the network.
export default function CommandCentreLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
