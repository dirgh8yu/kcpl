import Link from "next/link";
import { AdminDashboard } from "./admin-dashboard";
import { getAdminAccess } from "./admin-auth";
import type { QuoteSummary } from "./admin-data";

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
    const { listQuoteSummaries } = await import("./admin-data");
    const quotes = await listQuoteSummaries();
    return quotes === null ? { kind: "unavailable" } : { kind: "ready", quotes };
  } catch (error) {
    console.error("Failed to load KCPL operations dashboard", error);
    return { kind: "error" };
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ auth?: string }>;
}) {
  const access = await getAdminAccess();

  if (access.kind === "unconfigured") {
    return (
      <AdminGate
        title="Admin login needs configuration."
        detail="Add KCPL_ADMIN_PASSWORD and KCPL_ADMIN_SESSION_SECRET as encrypted Cloudflare Worker secrets, then reload /admin."
      />
    );
  }

  if (access.kind === "signed-out") {
    const params = searchParams ? await searchParams : {};
    return <AdminLogin failed={params.auth === "failed"} />;
  }

  const result = await loadQuotes();
  if (result.kind === "unavailable") {
    return (
      <AdminGate
        title="Quote storage is not available yet."
        detail="The admin dashboard is ready, but the Cloudflare D1 DB binding has not been provisioned for this deployment."
        signOutPath="/api/admin/session?logout=1"
      />
    );
  }
  if (result.kind === "error") {
    return (
      <AdminGate
        title="The quote desk could not be loaded."
        detail="KCPL's stored enquiries are temporarily unavailable. No quote data was exposed."
        signOutPath="/api/admin/session?logout=1"
      />
    );
  }

  return (
    <AdminDashboard
      initialQuotes={result.quotes}
      userName={access.user.displayName}
      signOutPath="/api/admin/session?logout=1"
    />
  );
}

function AdminLogin({ failed }: { failed: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
      <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Operations</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">Private operations desk</h1>
        <p className="mt-4 text-sm leading-7 text-black/60">
          Enter the KCPL admin password to manage freight enquiries, assignments and internal notes.
        </p>
        <form action="/api/admin/session" method="post" className="mt-7 space-y-4">
          <label className="block text-sm font-bold" htmlFor="admin-password">Admin password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#b78a3e]"
          />
          {failed ? <p className="text-sm font-bold text-red-700">That password was not accepted.</p> : null}
          <button type="submit" className="w-full rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">
            Open operations dashboard
          </button>
        </form>
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
