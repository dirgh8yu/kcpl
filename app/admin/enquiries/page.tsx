import { redirect } from "next/navigation";
import { getAdminAccess } from "../admin-auth";
import { AdminDashboard } from "../admin-dashboard";
import type { QuoteSummary } from "../admin-data";
import type { KcplStaffContext } from "../staff-directory.server";
import { getStaffContext } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { loginHref } from "../admin-entry";
import { V4WorkspaceGate } from "../v4-workspace-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiries | KCPL Operations", robots: { index: false, follow: false } };

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
  if (access.kind === "unconfigured") {
    return <V4WorkspaceGate
      eyebrow="System gate"
      title="Firebase admin access needs configuration"
      detail="KCPL Operations cannot load enquiries until the Firebase App Hosting runtime and authorised staff access are configured."
      actions={[{ href: "/", label: "Return to website", primary: true }]}
    />;
  }
  if (access.kind === "signed-out") redirect(loginHref("/admin/enquiries"));

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
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><V4WorkspaceGate eyebrow="Enquiries" title="Firestore is not available yet" detail="Navigation and search remain available while KCPL enquiry data stays fail-closed." embedded actions={[{ href: "/admin/command-centre", label: "Operations Overview", primary: true }]}/></OperationsShell>;
  if (result.kind === "error") return <OperationsShell {...shellProps}><V4WorkspaceGate eyebrow="Enquiries" title="The enquiry desk could not be loaded" detail="KCPL's Firebase data is temporarily unavailable. No enquiry data was exposed." embedded actions={[{ href: "/admin/command-centre", label: "Operations Overview", primary: true }]}/></OperationsShell>;

  const requestedReference = enquiry?.trim().toUpperCase();
  const orderedQuotes = requestedReference
    ? [...result.quotes].sort((a, b) => Number(b.reference === requestedReference) - Number(a.reference === requestedReference))
    : result.quotes;

  return <OperationsShell {...shellProps}><AdminDashboard initialQuotes={orderedQuotes} canViewCommercial={staff.permissions.canViewCommercial} canEditCommercial={staff.permissions.canEditCommercial}/></OperationsShell>;
}
