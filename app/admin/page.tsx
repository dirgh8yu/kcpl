import Link from "next/link";
import { AdminDashboard } from "./admin-dashboard";
import { getAdminAccess } from "./admin-auth";
import { AdminLogin } from "./admin-login";
import { getStaffContext } from "./staff-directory.server";
import type { QuoteSummary } from "./admin-data";
import { OperationsShell } from "./operations-shell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Enquiries | KCPL Operations",
  robots: { index: false, follow: false },
};

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

  if (access.kind === "unconfigured") {
    return <AdminGate title="Firebase admin access needs configuration." detail="Configure the Firebase project in App Hosting, then create the initial staff account in Firebase Authentication. KCPL_ADMIN_EMAILS can be used as the bootstrap management allowlist." />;
  }

  if (access.kind === "signed-out") return <AdminLoginPage />;

  const staff = await getStaffContext(access.user);
  const result = await loadQuotes();
  if (result.kind === "unavailable") return <AdminGate title="Firestore is not available yet." detail="KCPL Operations is connected to Firebase Authentication, but the Firestore backend is not available for this deployment." signOutPath="/api/admin/session?logout=1" />;
  if (result.kind === "error") return <AdminGate title="The enquiry desk could not be loaded." detail="KCPL's Firebase data is temporarily unavailable. No quote data was exposed." signOutPath="/api/admin/session?logout=1" />;

  return (
    <OperationsShell
      userName={access.user.displayName}
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
    <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]">
      <section className="w-full max-w-md rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">Private operations desk</h1>
        <p className="mt-3 text-sm leading-6 text-[#68747f]">Sign in with your authorised KCPL Firebase staff account to manage enquiries, quotations, shipments, tracking and documents.</p>
        <AdminLogin />
        <Link href="/" className="mt-5 inline-block text-xs font-semibold text-[#6f7a84] underline underline-offset-4">Return to website</Link>
      </section>
    </main>
  );
}

function AdminGate({ title, detail, signOutPath }: { title: string; detail: string; signOutPath?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Return to website</Link>{signOutPath ? <a href={signOutPath} className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Sign out</a> : null}</div>
      </section>
    </main>
  );
}
