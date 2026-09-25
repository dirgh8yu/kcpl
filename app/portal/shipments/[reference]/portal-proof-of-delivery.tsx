import { OpsDetailGrid, OpsDetailItem, OpsSurface } from "../../../admin/operations-ui";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";
import { portalDateTime } from "../../portal-format";
import type { PortalProofOfDelivery } from "../../portal-proof-of-delivery";

/** Who received it, when, and the signature and photos KCPL verified and
 * chose to share. Images come through the gated pod route, never a public
 * storage link. */
export function PortalProofOfDeliveryCard({ reference, proof, locale }: { reference: string; proof: PortalProofOfDelivery; locale: PortalLocale }) {
  const t = portalTranslator(locale);
  const src = (id: string) => `/api/portal/shipments/${encodeURIComponent(reference)}/pod/${encodeURIComponent(id)}`;
  const label = (kind: string) => t(kind === "signature" ? "pod.signature" : kind === "photo" ? "pod.photo" : "pod.document");
  return (
    <OpsSurface eyebrow={t("pod.eyebrow")} title={t("pod.title")} description={t("pod.description")}>
      <OpsDetailGrid>
        <OpsDetailItem label={t("pod.received_by")}>
          {[proof.recipient_name, proof.recipient_relation].filter(Boolean).join(" · ") || "—"}
        </OpsDetailItem>
        <OpsDetailItem label={t("pod.delivered_at")}>{portalDateTime(proof.delivered_at)}</OpsDetailItem>
      </OpsDetailGrid>
      {proof.items.length ? (
        <div className="portal-pod-grid">
          {proof.items.map((item) => (
            <figure key={item.id} className={`portal-pod-item portal-pod-${item.kind}`}>
              {item.content_type.startsWith("image/") ? (
                <a href={src(item.id)} target="_blank" rel="noreferrer" aria-label={`${label(item.kind)} · ${t("pod.open")}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a gated, private image; next/image would proxy it */}
                  <img src={src(item.id)} alt={label(item.kind)} loading="lazy"/>
                </a>
              ) : (
                <a href={src(item.id)} target="_blank" rel="noreferrer">{t("pod.open")}</a>
              )}
              <figcaption>{label(item.kind)}{item.captured_at ? ` · ${portalDateTime(item.captured_at)}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </OpsSurface>
  );
}
