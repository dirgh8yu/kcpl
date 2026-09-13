import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
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
  return (
    <main className="min-h-screen bg-[#F6F6F3] text-[#101010]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
        <section className="relative hidden overflow-hidden border-r border-black/10 bg-[#101010] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-[#DC143C]/25 blur-3xl" />
          <div className="absolute -bottom-20 left-16 h-72 w-72 rounded-full bg-[#DC143C]/10 blur-3xl" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white p-3 shadow-[0_16px_38px_rgba(0,0,0,0.28)]">
              <Image src="/images/brand/kcpl-gateway-k.svg" alt="KCPL Gateway K" width={36} height={36} priority />
            </div>
            <div>
              <p className="text-[17px] font-extrabold tracking-[-0.02em]">KAPILESHWOR</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">Cargo Pvt. Ltd.</p>
            </div>
          </div>

          <div className="relative z-10 max-w-[650px] pb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF8BA2]">KCPL Operations</p>
            <h1 className="mt-5 max-w-[620px] text-[42px] font-extrabold leading-[1.04] tracking-[-0.045em] xl:text-[54px]">
              One private workspace for the cargo operation.
            </h1>
            <p className="mt-6 max-w-[560px] text-[15px] font-medium leading-7 text-white/62">
              Access enquiries, shipment records, customer accounts, commercial controls and live operational workflows from one secure staff system.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-2.5 text-[11px] font-semibold text-white/48">
            <ShieldCheck size={15} />
            <span>Authorised KCPL staff only</span>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[480px]">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white p-2.5 shadow-[0_10px_28px_rgba(16,16,16,0.08)] ring-1 ring-black/5">
                <Image src="/images/brand/kcpl-gateway-k.svg" alt="KCPL Gateway K" width={28} height={28} priority />
              </div>
              <div>
                <p className="text-[14px] font-extrabold tracking-[-0.02em]">KAPILESHWOR</p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#72726D]">Cargo Pvt. Ltd.</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-[0_24px_70px_rgba(16,16,16,0.08)] sm:p-8 xl:p-10">
              <div className="flex items-center justify-between gap-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F6F6F3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5C5C57]">
                  <LockKeyhole size={12} /> Private access
                </span>
                <span className="h-2 w-2 rounded-full bg-[#DC143C] shadow-[0_0_0_5px_rgba(220,20,60,0.08)]" aria-hidden="true" />
              </div>

              <div className="mt-7">
                <h2 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.04em] sm:text-[34px]">Sign in to Operations</h2>
                <p className="mt-3 max-w-[410px] text-[13px] font-medium leading-6 text-[#666661]">
                  Use your authorised KCPL staff account. Your session is created securely after Firebase verifies your credentials.
                </p>
              </div>

              <AdminLogin />

              <div className="mt-8 border-t border-black/[0.08] pt-5">
                <div className="flex flex-col gap-3 text-[11px] font-medium text-[#777772] sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck size={14} /> Firebase-authenticated access
                  </span>
                  <Link href="/" className="font-semibold text-[#101010] underline decoration-black/20 underline-offset-4 transition hover:text-[#DC143C] hover:decoration-[#DC143C]/40">
                    Return to public website
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-5 px-2 text-center text-[10px] font-medium leading-5 text-[#8A8A84]">
              Access is restricted to approved KCPL personnel. Unauthorised access attempts may be logged.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
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
