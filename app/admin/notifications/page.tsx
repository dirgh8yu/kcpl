import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { NotificationsWorkspace } from "./notifications-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notification Centre | KCPL Operations", robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="The notification centre is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <NotificationsWorkspace />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Notifications</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations Home</Link><Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="md">Tasks & alerts</Link></div></section></main>;
}
