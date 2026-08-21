import Link from "next/link";
import { CheckCircle2, CircleAlert, Mail, MapPinned, RadioTower } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { OpsBadge, OpsPage, OpsPageHeader, OpsSurface } from "../operations-ui";
import { GoogleRoadRoutePanel } from "../routes/google-road-route-panel";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { MarketEstimateWorkspace } from "./market-estimate-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Estimate | KCPL Operations", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Market Estimate", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} isManagement={permissions.role === "management"}><Gate title="Market tools could not be loaded" detail="KCPL staff or integration data is temporarily unavailable. Navigation and search remain available while the service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Market intelligence tools are available to Management, Accounts and Commercial roles." embedded/></OperationsShell>;

  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  const routesConfigured = Boolean(process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim());
  const placesConfigured = Boolean(process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim());
  const emailConfigured = Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.KCPL_EMAIL_FROM?.trim());

  return (
    <OperationsShell {...shellProps}>
      <OpsPage>
        <OpsPageHeader
          eyebrow="Commercial intelligence"
          title="Market estimate"
          description="Live reference tools are back in the KCPL admin: external freight benchmarking, Nepal Rastra Bank forex, Google road distance/ETA and Google Places-assisted route entry. Reference data remains advisory and never overwrites a customer quote automatically."
          meta={<><OpsBadge tone="accent">{roleLabel}</OpsBadge><span>Live integration workspace</span></>}
          actions={<div className="flex flex-wrap gap-2"><Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="sm">Open Rate Desk</Link><Link href="/admin/pricing" className="ops-button" data-variant="secondary" data-size="sm">Pricing Desk</Link><Link href="/admin/consolidation" className="ops-button" data-variant="secondary" data-size="sm">Load Planner</Link></div>}
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

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#332d29] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Operations</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><Link href="/admin" className="mt-6 inline-flex rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Back to enquiries</Link></section></main>;
}
