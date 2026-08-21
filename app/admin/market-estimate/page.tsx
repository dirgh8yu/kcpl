import Link from "next/link";
import { CheckCircle2, CircleAlert, Mail, MapPinned, RadioTower } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { OpsBadge, OpsPage, OpsPageHeader, OpsSurface } from "../operations-ui";
import { GoogleRoadRoutePanel } from "../routes/google-road-route-panel";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { MarketEstimateWorkspace } from "./market-estimate-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Estimate | KCPL Operations", robots: { index: false, follow: false } };

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required" detail="Market intelligence tools are available to Management, Accounts and Commercial roles."/>;

  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  const routesConfigured = Boolean(process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim());
  const placesConfigured = Boolean(process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim());
  const emailConfigured = Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.KCPL_EMAIL_FROM?.trim());

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
      <OpsPage>
        <OpsPageHeader
          eyebrow="Commercial intelligence"
          title="Market estimate"
          description="Live reference tools are back in the KCPL admin: external freight benchmarking, Nepal Rastra Bank forex, Google road distance/ETA and Google Places-assisted route entry. Reference data remains advisory and never overwrites a customer quote automatically."
          meta={<><OpsBadge tone="accent">{roleLabel}</OpsBadge><span>Live integration workspace</span></>}
          actions={<Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="sm">Open Rate Desk</Link>}
        />

        <div className="ops-content ops-stack">
          <OpsSurface eyebrow="Integration status" title="Connected operational data sources" description="This panel makes external integrations visible so a UI redesign cannot silently hide them again.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <IntegrationCard icon={<RadioTower size={15}/>} title="External freight benchmark" detail="Freightos public estimate adapter" state="available" />
              <IntegrationCard icon={<CheckCircle2 size={15}/>} title="NRB Forex" detail="Official Nepal Rastra Bank reference rates" state="available" />
              <IntegrationCard icon={<MapPinned size={15}/>} title="Google Routes + Places" detail={routesConfigured && placesConfigured ? "Firebase secrets detected" : "API code restored · check Firebase secrets"} state={routesConfigured && placesConfigured ? "available" : "setup"} />
              <IntegrationCard icon={<Mail size={15}/>} title="SendGrid quote email" detail={emailConfigured ? "Firebase email configuration detected" : "API code restored · check Firebase secrets"} state={emailConfigured ? "available" : "setup"} />
            </div>
          </OpsSurface>

          <ForexReferencePanel compact />
          <GoogleRoadRoutePanel initialOrigin="Kolkata, India" initialDestination="Kathmandu, Nepal" compact />
        </div>
      </OpsPage>

      <MarketEstimateWorkspace roleLabel={roleLabel}/>
    </OperationsShell>
  );
}

function IntegrationCard({ icon, title, detail, state }: { icon: React.ReactNode; title: string; detail: string; state: "available" | "setup" }) {
  return <div className="rounded-[13px] border border-[#e7dfd8] bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <span className={state === "available" ? "text-[#6f8874]" : "text-[#b07a38]"}>{icon}</span>
      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold ${state === "available" ? "text-[#6f8874]" : "text-[#a26d2d]"}`}>
        {state === "available" ? <CheckCircle2 size={11}/> : <CircleAlert size={11}/>}
        {state === "available" ? "Available" : "Check setup"}
      </span>
    </div>
    <strong className="mt-3 block text-[11px] text-[#4b423c]">{title}</strong>
    <p className="mt-1 text-[9px] leading-4 text-[#8a8078]">{detail}</p>
  </div>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Operations</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><Link href="/admin" className="mt-6 inline-flex rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Back to enquiries</Link></section></main>;
}
