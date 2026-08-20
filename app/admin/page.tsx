import Link from "next/link";
import { AdminDashboard } from "./admin-dashboard";
import { getAdminAccess } from "./admin-auth";
import { AdminLogin } from "./admin-login";
import { getStaffContext } from "./staff-directory.server";
import type { QuoteSummary } from "./admin-data";
import { OperationsShell } from "./operations-shell";
import { kcplStaffRoleLabels } from "./staff-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiries | KCPL Operations", robots: { index: false, follow: false } };

type QuoteLoadResult =
  | { kind: "ready"; quotes: QuoteSummary[] }
  | { kind: "unavailable" }
  | { kind: "error" };

async function loadQuotes(): Promise<QuoteLoadResult> {
  try {
    const { listQuoteSummaries } = await import("./admin-data.server");
    const quotes = await listQuoteSummaries();
    return quotes === null ? { kind: "unavailable" } : { kind: "ready", quotes };
  } catch (error) {
    console.error("Failed to load KCPL Firebase operations dashboard", error);
    return { kind: "error" };
  }
}

export default async function AdminPage() {
  const access = await getAdminAccess();
  if (access.kind === "unconfigured") return <AdminGate title="Firebase admin access needs configuration." detail="Configure the Firebase project in App Hosting, then create the initial staff account in Firebase Authentication. KCPL_ADMIN_EMAILS can be used as the bootstrap management allowlist." />;
  if (access.kind === "signed-out") return <AdminLoginPage />;

  const staff = await getStaffContext(access.user);
  const result = await loadQuotes();
  if (result.kind === "unavailable") return <AdminGate title="Firestore is not available yet." detail="KCPL Operations is connected to Firebase Authentication, but the Firestore backend is not available for this deployment." signOutPath="/api/admin/session?logout=1" />;
  if (result.kind === "error") return <AdminGate title="The enquiry desk could not be loaded." detail="KCPL's Firebase data is temporarily unavailable. Existing records remain protected." signOutPath="/api/admin/session?logout=1" />;

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={kcplStaffRoleLabels[staff.permissions.role]}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <AdminDashboard initialQuotes={result.quotes} />
    </OperationsShell>
  );
}

function AdminLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]">
      <section className="w-full max-w-[420px] rounded-xl border border-[#e2e5e8] bg-white p-7 shadow-[0_12px_36px_rgba(15,23,42,.06)] sm:p-8">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef0ff] text-xs font-black text-[#3445a3]">K</span><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#7b838c]">KCPL Operations</p><p className="mt-0.5 text-[10px] text-[#a0a6ac]">Authorised staff access</p></div></div>
        <h1 className="mt-6 text-[26px] font-semibold tracking-[-.04em] text-[#20252a]">Sign in</h1>
        <p className="mt-2 text-[12px] leading-5 text-[#6d757e]">Access enquiries, quotations, shipments, customs, customer records and finance workspaces.</p>
        <AdminLogin />
        <Link href="/" className="mt-5 inline-block text-[11px] font-medium text-[#737c85] underline decoration-[#c8ccd1] underline-offset-4 hover:text-[#3445a3]">Return to public website</Link>
      </section>
    </main>
  );
}

function AdminGate({ title, detail, signOutPath }: { title: string; detail: string; signOutPath?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]">
      <section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Operations</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/" className="inline-flex h-9 items-center rounded-lg bg-[#283a77] px-4 text-xs font-semibold text-white">Return to website</Link>{signOutPath ? <a href={signOutPath} className="inline-flex h-9 items-center rounded-lg border border-[#dfe2e6] px-4 text-xs font-semibold text-[#505861]">Sign out</a> : null}</div>
      </section>
    </main>
  );
}
