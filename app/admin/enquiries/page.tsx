import "../plan-sell-premium.css";
import { redirect } from "next/navigation";
import { getAdminAccess } from "../admin-auth";
import { AdminDashboard } from "../admin-dashboard";
import type { QuoteSummary } from "../admin-data";
import { OperationsShell } from "../operations-shell";
import { getStaffContext, type KcplStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiries", robots: { index: false, follow: false } };

type QuoteLoadResult = { kind: "ready"; quotes: QuoteSummary[] } | { kind: "unavailable" } | { kind: "error" };

async function loadQuotes(staff: KcplStaffContext): Promise<QuoteLoadResult> {
  try {
    const { listQuoteSummaries } = await import("../admin-data.server");
    const quotes = await listQuoteSummaries(staff);
    return quotes === null ? { kind: "unavailable" } : { kind: "ready", quotes };
  } catch (error) {
    console.error("Failed to load KCPL Firebase enquiry desk", error);
    return { kind: "error" };
  }
}

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ enquiry?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") redirect("/admin");

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };

  const { enquiry } = await searchParams;
  const result = await loadQuotes(staff);
  if (result.kind === "unavailable") {
    return <OperationsShell {...shellProps}><EnquiryGate title="Enquiries can’t be shown right now" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  }
  if (result.kind === "error") {
    return <OperationsShell {...shellProps}><EnquiryGate title="Enquiries didn’t load" detail="Something went wrong fetching them. Reload the page to try again."/></OperationsShell>;
  }

  const requestedReference = enquiry?.trim().toUpperCase();
  const orderedQuotes = requestedReference
    ? [...result.quotes].sort((a, b) => Number(b.reference === requestedReference) - Number(a.reference === requestedReference))
    : result.quotes;

  return (
    <OperationsShell {...shellProps}>
      <AdminDashboard
        initialQuotes={orderedQuotes}
        canViewCommercial={staff.permissions.canViewCommercial}
        canEditCommercial={staff.permissions.canEditCommercial}
      />
    </OperationsShell>
  );
}

function EnquiryGate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate
    eyebrow="Enquiries"
    title={title}
    detail={detail}
    embedded
    actions={[
      { href: "/admin/command-centre", label: "Overview", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  />;
}
