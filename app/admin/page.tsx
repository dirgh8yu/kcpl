import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "./admin-auth";
import { AdminDashboard } from "./admin-dashboard";
import type { QuoteSummary } from "./admin-data";
import { AdminLogin } from "./admin-login";
import { OperationsShell } from "./operations-shell";
import { getStaffContext, type KcplStaffContext } from "./staff-directory.server";
import { V4WorkspaceGate } from "./v4-workspace-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiries | KCPL Operations", robots: { index: false, follow: false } };

type QuoteLoadResult = { kind: "ready"; quotes: QuoteSummary[] } | { kind: "unavailable" } | { kind: "error" };

async function loadQuotes(staff: KcplStaffContext): Promise<QuoteLoadResult> {
  try {
    const { listQuoteSummaries } = await import("./admin-data.server");
    const quotes = await listQuoteSummaries(staff);
    return quotes === null ? { kind: "unavailable" } : { kind: "ready", quotes };
  } catch (error) {
    console.error("Failed to load KCPL Firebase enquiry desk", error);
    return { kind: "error" };
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ enquiry?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind === "unconfigured") return <AdminGate title="Firebase admin access needs configuration" detail="Configure the Firebase project in App Hosting, then create the initial staff account in Firebase Authentication. KCPL_ADMIN_EMAILS can be used as the bootstrap management allowlist."/>;
  if (access.kind === "signed-out") return <AdminLoginPage/>;

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
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><AdminGate title="Firestore is not available yet" detail="KCPL Operations is connected to Firebase Authentication, but the Firestore backend is not available for this deployment. Navigation and search remain available." signOutPath="/api/admin/session?logout=1" embedded/></OperationsShell>;
  if (result.kind === "error") return <OperationsShell {...shellProps}><AdminGate title="The enquiry desk could not be loaded" detail="KCPL's Firebase data is temporarily unavailable. Navigation and search remain available and no enquiry data was exposed." signOutPath="/api/admin/session?logout=1" embedded/></OperationsShell>;

  const requestedReference = enquiry?.trim().toUpperCase();
  const orderedQuotes = requestedReference
    ? [...result.quotes].sort((a, b) => Number(b.reference === requestedReference) - Number(a.reference === requestedReference))
    : result.quotes;

  return <OperationsShell {...shellProps}><AdminDashboard initialQuotes={orderedQuotes} canViewCommercial={staff.permissions.canViewCommercial} canEditCommercial={staff.permissions.canEditCommercial}/></OperationsShell>;
}

function AdminLoginPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f6f3] p-6 text-[#141414]">
    <section className="w-full max-w-[460px] border-y border-[#e2e2e2] bg-white px-8 py-9 sm:px-10">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[6px] bg-[#dc143c] text-[12px] font-semibold text-white">K</span><div><p className="text-[13px] font-semibold text-[#141414]">KCPL Operations</p><p className="mt-0.5 text-[10px] font-medium text-[#737373]">Private freight workspace</p></div></div>
      <div className="mt-7"><p className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#737373]">Authorised staff</p><h1 className="mt-2 text-[24px] font-semibold leading-[32px] tracking-[-.02em]">Sign in</h1><p className="mt-2 text-[13px] leading-6 text-[#5b5b5b]">Use your KCPL Firebase staff account to access enquiries, shipments, customers, finance and operational controls.</p></div>
      <AdminLogin/>
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e2e2e2] pt-4"><span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#737373]"><ShieldCheck size={11}/>Firebase-authenticated staff only</span><Link href="/" className="text-[10px] font-semibold text-[#5b5b5b] hover:text-[#141414]">Public website</Link></div>
    </section>
  </main>;
}

function AdminGate({ title, detail, signOutPath, embedded = false }: { title: string; detail: string; signOutPath?: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Operations"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={signOutPath
      ? [{ href: "/admin/command-centre", label: "Operations Overview", primary: true }, { href: signOutPath, label: "Sign out" }]
      : [{ href: "/", label: "Public website", primary: true }]}
  />;
}
