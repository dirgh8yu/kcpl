import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignOutPath } from "../chatgpt-auth";
import { AdminDashboard } from "./admin-dashboard";
import { getAdminAccess } from "./admin-auth";
import { listQuoteSummaries } from "./admin-data";

export const metadata = {
  title: "KCPL Operations",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const access = await getAdminAccess("/admin");
  if (access.kind === "signed-out") redirect(access.signInPath);

  if (access.kind === "unconfigured") {
    return <AdminGate title="Admin access needs one setting." detail={`You are signed in as ${access.user.email}. Add this email to the KCPL_ADMIN_EMAILS environment variable, then reload /admin.`} signOutPath={chatGPTSignOutPath("/")}/>;
  }

  if (access.kind === "forbidden") {
    return <AdminGate title="This account is not an authorised KCPL admin." detail={`Signed in as ${access.user.email}. Only emails listed in KCPL_ADMIN_EMAILS can open the operations dashboard.`} signOutPath={chatGPTSignOutPath("/admin")}/>;
  }

  try {
    const quotes = await listQuoteSummaries();
    if (quotes === null) {
      return <AdminGate title="Quote storage is not available yet." detail="The admin dashboard is ready, but the Cloudflare D1 DB binding has not been provisioned for this deployment." signOutPath={chatGPTSignOutPath("/")}/>;
    }
    return <AdminDashboard initialQuotes={quotes} userName={access.user.displayName} signOutPath={chatGPTSignOutPath("/")}/>;
  } catch (error) {
    console.error("Failed to load KCPL operations dashboard", error);
    return <AdminGate title="The quote desk could not be loaded." detail="KCPL's stored enquiries are temporarily unavailable. No quote data was exposed." signOutPath={chatGPTSignOutPath("/")}/>;
  }
}

function AdminGate({ title, detail, signOutPath }: { title: string; detail: string; signOutPath: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
    <section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
      <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Operations</p>
      <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1>
      <p className="mt-4 text-sm leading-7 text-black/60">{detail}</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Return to website</Link><a href={signOutPath} className="rounded-xl border border-black/10 px-5 py-3 text-sm font-black">Sign out</a></div>
    </section>
  </main>;
}
