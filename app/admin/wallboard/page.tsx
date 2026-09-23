import "./wallboard.css";
import { getAdminAccess } from "../admin-auth";
import { getNotificationPreferences, listOperationsNotifications } from "../notifications/notification-centre.server";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { loadCommandCentre } from "../command-centre/command-centre.server";
import { buildWallboard } from "../wallboard-data";
import { WallboardView } from "./wallboard-view";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ops Wallboard | KCPL Operations",
  robots: { index: false, follow: false },
};

/**
 * Fullscreen operations wallboard (TV mode) for the office display. Deliberately
 * outside the OperationsShell: no sidebar, no chrome, one dark screen the whole
 * floor can read. Same authorization bar as the register — admin session plus
 * Job File access — and the same loaders, so the TV can never show a number a
 * staff member could not see on the register itself.
 */
export default async function WallboardPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <WallboardGate title="Sign in to KCPL Operations" detail="The wallboard is available only to authorised KCPL staff." />;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return <WallboardGate title="Wallboard is restricted" detail="Your current staff role does not include operational Job File access." />;

  const state = await loadWallboardState(staff, access.user.email);
  if (state.kind === "unavailable") return <WallboardGate title="Wallboard data is unavailable" detail="The Firebase operational data service is not available for this deployment." />;
  if (state.kind === "error") return <WallboardGate title="Wallboard could not be loaded" detail="KCPL operational data is temporarily unavailable." />;
  return <WallboardView initial={state.wallboard} initialGeneratedAt={state.generatedAt} />;
}

/** Load and project the wallboard state; JSX construction stays out of try/catch. */
async function loadWallboardState(
  staff: Awaited<ReturnType<typeof getStaffContext>>,
  email: string,
): Promise<{ kind: "ready"; wallboard: ReturnType<typeof buildWallboard>; generatedAt: string } | { kind: "unavailable" } | { kind: "error" }> {
  try {
    const [data, notificationsResult, preferences] = await Promise.all([
      loadCommandCentre(staff, { includeDelivered: true }),
      listOperationsNotifications(staff, email).catch((error: unknown) => {
        console.error("KCPL wallboard notification feed failed", error);
        return null;
      }),
      getNotificationPreferences(staff.profile.uid),
    ]);
    if (!data) return { kind: "unavailable" };
    const notifications = notificationsResult?.notifications.filter((item) => preferences.categories[item.category]) ?? [];
    return { kind: "ready", wallboard: buildWallboard(data, notifications, new Date()), generatedAt: data.generated_at };
  } catch (error) {
    console.error("KCPL wallboard load failed", error);
    return { kind: "error" };
  }
}

function WallboardGate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate eyebrow="KCPL Operations" title={title} detail={detail} actions={[{ href: "/admin/command-centre", label: "Operations Overview", primary: true }]} />;
}
