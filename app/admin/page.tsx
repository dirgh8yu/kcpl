import Link from "next/link";
import { AdminDashboard } from "./admin-dashboard";
import { getAdminAccess } from "./admin-auth";
import { AdminLogin } from "./admin-login";
import { getStaffContext } from "./staff-directory.server";
import type { QuoteSummary } from "./admin-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KCPL Operations",
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
    return (
      <AdminGate
        title="Firebase admin access needs configuration."
        detail="Configure the Firebase project in App Hosting, then create the initial staff account in Firebase Authentication. KCPL_ADMIN_EMAILS can be used as the bootstrap management allowlist."
      />
    );
  }

  if (access.kind === "signed-out") {
    return <AdminLoginPage />;
  }

  const staff = await getStaffContext(access.user);
  const result = await loadQuotes();
  if (result.kind === "unavailable") {
    return (
      <AdminGate
        title="Firestore is not available yet."
        detail="KCPL Operations is connected to Firebase Authentication, but the Firestore backend is not available for this deployment."
        signOutPath="/api/admin/session?logout=1"
      />
    );
  }
  if (result.kind === "error") {
    return (
      <AdminGate
        title="The quote desk could not be loaded."
        detail="KCPL's Firebase data is temporarily unavailable. No quote data was exposed."
        signOutPath="/api/admin/session?logout=1"
      />
    );
  }

  return (
    <>
      <AdminDashboard
        initialQuotes={result.quotes}
        userName={access.user.displayName}
        signOutPath="/api/admin/session?logout=1"
      />
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {staff.permissions.canManageJobFile ? <Link href="/admin/command-centre" className="rounded-2xl bg-[#b78a3e] px-5 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#9d7433]">Command Centre</Link> : null}
        {staff.permissions.canManageStaff ? <Link href="/admin/staff" className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[.1em] text-[#10263f] shadow-lg transition hover:-translate-y-0.5">Staff & branches</Link> : null}
        <Link
          href="/admin/crm"
          className="rounded-2xl border border-white/15 bg-[#10263f] px-5 py-3 text-xs font-black uppercase tracking-[.12em] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#173958]"
        >
          Open CRM
        </Link>
      </div>
    </>
  );
}

function AdminLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
      <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Operations</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">Private operations desk</h1>
        <p className="mt-4 text-sm leading-7 text-black/60">
          Sign in with your authorised KCPL Firebase staff account to manage enquiries, quotations, shipments, tracking and documents.
        </p>
        <AdminLogin />
        <Link href="/" className="mt-5 inline-block text-sm font-bold text-black/55 underline underline-offset-4">
          Return to website
        </Link>
      </section>
    </main>
  );
}

function AdminGate({
  title,
  detail,
  signOutPath,
}: {
  title: string;
  detail: string;
  signOutPath?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Operations</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-black/60">{detail}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Return to website</Link>
          {signOutPath ? <a href={signOutPath} className="rounded-xl border border-black/10 px-5 py-3 text-sm font-black">Sign out</a> : null}
        </div>
      </section>
    </main>
  );
}
