import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AdminDashboard } from "./admin-dashboard";
import { getAdminAccess } from "./admin-auth";
import { AdminLogin } from "./admin-login";
import { getStaffContext, type KcplStaffContext } from "./staff-directory.server";
import type { QuoteSummary } from "./admin-data";
import { OperationsShell } from "./operations-shell";

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
  const { enquiry } = await searchParams;
  const result = await loadQuotes(staff);
  if (result.kind === "unavailable") return <AdminGate title="Firestore is not available yet" detail="KCPL Operations is connected to Firebase Authentication, but the Firestore backend is not available for this deployment." signOutPath="/api/admin/session?logout=1"/>;
  if (result.kind === "error") return <AdminGate title="The enquiry desk could not be loaded" detail="KCPL's Firebase data is temporarily unavailable. No enquiry data was exposed." signOutPath="/api/admin/session?logout=1"/>;

  const requestedReference = enquiry?.trim().toUpperCase();
  const orderedQuotes = requestedReference
    ? [...result.quotes].sort((a, b) => Number(b.reference === requestedReference) - Number(a.reference === requestedReference))
    : result.quotes;

  return <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}><AdminDashboard initialQuotes={orderedQuotes} canViewCommercial={staff.permissions.canViewCommercial} canEditCommercial={staff.permissions.canEditCommercial}/></OperationsShell>;
}

function AdminLoginPage() {
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f8f6f3] p-6 text-[#332d29]">
    <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#f1c9b8]/25 blur-3xl"/>
    <div className="pointer-events-none absolute -bottom-24 -left-24 h-[360px] w-[360px] rounded-full bg-[#e7dccd]/40 blur-3xl"/>
    <section className="relative w-full max-w-[460px] rounded-[20px] border border-[#e6ddd6] bg-[#fffdfa]/95 p-8 shadow-[0_24px_70px_rgba(75,56,43,.08)] sm:p-10">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#e8755d] text-[12px] font-black text-white shadow-[0_8px_22px_rgba(191,91,68,.14)]">K</span><div><p className="text-[12px] font-[760] tracking-[-.02em] text-[#443b35]">KCPL Operations</p><p className="mt-0.5 text-[10px] font-semibold text-[#8f857d]">Private freight workspace</p></div></div>
      <div className="mt-8"><p className="text-[10px] font-bold text-[#a45c49]">Authorised staff</p><h1 className="mt-2 text-[29px] font-[735] tracking-[-.045em] leading-[1.05]">Welcome back.</h1><p className="mt-3 text-[13px] leading-6 text-[#756d66]">Sign in with your KCPL Firebase staff account to work enquiries, shipments, Job Files, customers, finance and operational alerts.</p></div>
      <AdminLogin/>
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#eee7e1] pt-4"><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#8f857d]"><ShieldCheck size={11}/>Firebase-authenticated staff only</span><Link href="/" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a96752]"><ArrowLeft size={10}/>Website</Link></div>
    </section>
  </main>;
}

function AdminGate({ title, detail, signOutPath }: { title: string; detail: string; signOutPath?: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)] sm:p-10"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#f3e8e1] text-[#b6654f]"><ShieldCheck size={16}/></span><p className="mt-5 text-[10px] font-bold text-[#a45c49]">KCPL Operations</p><h1 className="mt-2 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#756d66]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[11px] font-bold text-white">Return to website</Link>{signOutPath ? <a href={signOutPath} className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[11px] font-bold text-[#665c55]">Sign out</a> : null}</div></section></main>;
}
