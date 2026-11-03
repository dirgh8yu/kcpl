import { notFound, redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { OpsBadge, OpsDetailGrid, OpsDetailItem, OpsMono, OpsPage, OpsPageHeader, OpsSurface } from "../../../admin/operations-ui";
import { freightModeLabel } from "../../../admin/freight-mode";
import { getPartnerAccess } from "../../partner-auth";
import { getPartnerTender } from "../../partner-tenders.server";
import { partnerTenderStatusLabel, partnerTenderTone } from "../../partner-tenders";
import { PartnerShell } from "../../partner-shell";
import { PartnerTenderResponse } from "./partner-tender-response";
import { markTenderNotificationRead } from "../../partner-notifications.server";

export const dynamic = "force-dynamic";

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(amount);
}

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: decodeURIComponent((await params).id).toUpperCase(), robots: { index: false, follow: false } };
}

export default async function PartnerTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getPartnerAccess();
  if (access.kind !== "authorized") redirect("/partner");
  const { id } = await params;
  const tender = await getPartnerTender(access.session, decodeURIComponent(id));
  if (!tender) notFound();
  await markTenderNotificationRead(access.session, tender.id).catch(() => undefined);
  return <PartnerShell session={access.session}>
    <OpsPage>
      <OpsPageHeader
        eyebrow="Carrier tender"
        title={<OpsMono>{tender.reference}</OpsMono>}
        description={`${tender.origin || "Origin"} → ${tender.destination || "Destination"}`}
        meta={<><span>{freightModeLabel(tender.mode) || tender.mode}</span><span>Respond by {when(tender.response_due_at)}</span></>}
        actions={<OpsBadge tone={partnerTenderTone(tender.status)}>{partnerTenderStatusLabel(tender.status)}</OpsBadge>}
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <OpsSurface title="KCPL offer">
            <OpsDetailGrid columns={3}>
              <OpsDetailItem label="Offered cost">{money(tender.offered_cost, tender.currency)}</OpsDetailItem>
              <OpsDetailItem label="Mode">{freightModeLabel(tender.mode) || tender.mode}</OpsDetailItem>
              <OpsDetailItem label="Service">{tender.service || "—"}</OpsDetailItem>
              <OpsDetailItem label="Equipment">{tender.equipment || "—"}</OpsDetailItem>
              <OpsDetailItem label="Pickup">{tender.pickup_date || "To be confirmed"}</OpsDetailItem>
              <OpsDetailItem label="Sent">{when(tender.sent_at)}</OpsDetailItem>
            </OpsDetailGrid>
          </OpsSurface>

          {tender.can_respond ? <PartnerTenderResponse tenderId={tender.id} currency={tender.currency} offeredCost={tender.offered_cost}/> : <OpsSurface title="Your response">
            <OpsDetailGrid columns={3}>
              <OpsDetailItem label="Status">{partnerTenderStatusLabel(tender.status)}</OpsDetailItem>
              <OpsDetailItem label="Responded">{when(tender.responded_at)}</OpsDetailItem>
              {tender.counter_cost !== null ? <OpsDetailItem label="Counter-offer">{money(tender.counter_cost, tender.counter_currency || tender.currency)}</OpsDetailItem> : null}
            </OpsDetailGrid>
            {tender.response_note ? <p className="portal-footnote">{tender.response_note}</p> : null}
          </OpsSurface>}

          {!tender.can_respond && tender.status === "sent" ? <OpsSurface title="Response closed">
            <p className="portal-footnote m-0"><ClipboardList size={15} aria-hidden="true"/> The response deadline has passed. Ask your KCPL contact to re-send the tender.</p>
          </OpsSurface> : null}
        </div>
      </div>
    </OpsPage>
  </PartnerShell>;
}
