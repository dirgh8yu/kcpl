import { Geist } from "next/font/google";
import "../product.css";
import type { ReactNode } from "react";
import { getAdminAccess } from "./admin-auth";
import { getDisplayPreferences } from "./notifications/display-preferences.server";
import type { DisplayPreferences } from "./notifications/display-preferences";
import { OperationsDisplayPreferences } from "./operations-display-preferences";

const adminFont = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-admin-geist",
});

/** Server-side load of the signed-in operator's display preferences so the
 * first paint already carries their density and motion choice. Storage
 * failures never break the shell: the stylesheet's defaults (comfortable +
 * full motion) equal the unset state, so the attributes are simply omitted
 * and the client bootstrap retries the fetch. */
async function layoutDisplayPreferences(): Promise<DisplayPreferences | null> {
  try {
    const access = await getAdminAccess();
    if (access.kind !== "authorized") return null;
    const { getStaffContext } = await import("./staff-directory.server");
    const staff = await getStaffContext(access.user);
    return await getDisplayPreferences(staff.profile.uid);
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let density: DisplayPreferences["density"] | undefined;
  let motion: DisplayPreferences["motion"] | undefined;
  const preferences = await layoutDisplayPreferences();
  if (preferences) { density = preferences.density; motion = preferences.motion; }

  return (
    <div
      className={`${adminFont.className} ${adminFont.variable} kcpl-admin-route`}
      data-density={density}
      data-motion={motion}
    >
      {children}
      <OperationsDisplayPreferences/>
    </div>
  );
}
