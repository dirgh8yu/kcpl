import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { OpsBadge, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../admin/operations-ui";
import { getPartnerAccess } from "../partner-auth";
import { listPartnerTenders } from "../partner-tenders.server";
import { partnerTenderStatusLabel, partnerTenderTone } from "../partner-tenders";
import { PartnerShell } from "../partner-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tender desk", robots: { index: false, follow: false } };

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(amount);
}

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date);
}

export default async function PartnerTendersPage() {
  const access = await getPartnerAccess();
  if (access.kind !== "authorized") return redirect("/partner");
  const result = await listPartnerTenders(access.session);
  const tenders = result.kind === "ready" ? result.tenders : [];
  return <PartnerShell session={access.session}>
    <OpsPage>
      <OpsPageHeader
        eyebrow="Carrier desk"
        title="Tenders"
        description="Loads KCPL has offered your team. Accept, decline or send a counter-offer before the response deadline."
        meta={<span>{tenders.length} tender{tenders.length === 1 ? "" : "s"}</span>}
      />
      <div className="ops-content">
        <OpsSurface title="Your tenders" flush>
          {result.kind === "unavailable" ? <OpsEmptyState kind="unavailable" icon={<ClipboardList size={17}/>} title="The tender desk didn’t load" description="Try again in a minute."/>
            : tenders.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
              <thead><tr><th>Tender</th><th>Route</th><th>Offer</th><th>Response by</th><th>Status</th></tr></thead>
              <tbody>{tenders.map((tender) => <tr key={tender.id}>
                <td data-cell="primary"><Link href={`/partner/tenders/${encodeURIComponent(tender.id)}`} className="ops-cell-primary"><OpsMono>{tender.reference}</OpsMono></Link><span className="ops-cell-secondary">{tender.mode}{tender.service ? ` · ${tender.service}` : ""}</span></td>
                <td data-cell="route" data-label="Route">{tender.origin || "Origin"} → {tender.destination || "Destination"}</td>
                <td data-cell="meta" data-label="Offer">{money(tender.offered_cost, tender.currency)}</td>
                <td data-cell="meta" data-label="Response by">{when(tender.response_due_at)}</td>
                <td data-cell="meta" data-label="Status"><OpsBadge tone={partnerTenderTone(tender.status)}>{partnerTenderStatusLabel(tender.status)}</OpsBadge></td>
              </tr>)}</tbody>
            </table></OpsTableWrap>
              : <OpsEmptyState icon={<ClipboardList size={18}/>} title="No tenders right now" description="When KCPL offers your team a load, it appears here with its deadline."/>}
        </OpsSurface>
      </div>
    </OpsPage>
  </PartnerShell>;
}
