import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminAccess } from "../admin-auth";
import { AdminLogin } from "../admin-login";
import { safeAdminNext } from "../admin-entry";
import { V4WorkspaceGate } from "../v4-workspace-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff Sign In | KCPL Operations", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeAdminNext(next);
  const access = await getAdminAccess();

  if (access.kind === "authorized") redirect(nextPath);
  if (access.kind === "unconfigured") {
    return <V4WorkspaceGate
      eyebrow="System gate"
      title="Firebase admin access needs configuration"
      detail="KCPL Operations cannot accept staff sign-in until the Firebase App Hosting runtime and initial authorised staff identity are configured."
      actions={[{ href: "/", label: "Return to website", primary: true }]}
    />;
  }

  return <main className="grid min-h-screen place-items-center bg-[#f6f6f3] px-4 py-10 text-[#141414]">
    <section className="w-full max-w-[452px] rounded-[16px] border border-[#e2e2e2] bg-[#fffdfa] px-[26px] py-[26px] sm:px-[26px]">
      <div className="flex items-center gap-[14px]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#e8755d] text-[13px] font-bold text-white">K</span>
        <div>
          <p className="text-[13px] font-semibold leading-[18px]">KCPL Operations</p>
          <p className="mt-[2px] text-[10px] font-medium leading-[14px] text-[#737373]">Private freight workspace</p>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[9px] font-bold uppercase tracking-[.04em] text-[#a45c49]">Authorised staff</p>
        <h1 className="mt-3 text-[27px] font-semibold leading-[34px] tracking-[-.025em]">Welcome back.</h1>
        <p className="mt-2 max-w-[360px] text-[11px] leading-[17px] text-[#737373]">Sign in with your KCPL Firebase staff account to work operational records.</p>
      </div>

      <AdminLogin nextPath={nextPath}/>

      <div className="mt-6 border-t border-[#e2e2e2] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[9px] font-medium text-[#737373]">
          <span>KCPL staff access only</span>
          <Link href="/" className="font-semibold text-[#5b5b5b] hover:text-[#141414]">Return to website</Link>
        </div>
      </div>
    </section>
  </main>;
}
