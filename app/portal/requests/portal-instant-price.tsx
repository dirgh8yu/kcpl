"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Zap } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../admin/operations-ui";
import { portalDate, portalMoney } from "../portal-format";
import { portalTranslator, type PortalLocale, type PortalTextKey } from "../portal-i18n";
import { instantPrice, priceNeedsQuantity, type PortalPriceCard, type PortalPriceUnit } from "../portal-instant-price";

/** Each unit's words, named in full so the dictionary check can see them used. */
const unitText: Record<PortalPriceUnit, PortalTextKey> = {
  per_kg: "price.unit_per_kg",
  per_cbm: "price.unit_per_cbm",
  per_tonne: "price.unit_per_tonne",
  per_container: "price.unit_per_container",
  flat: "price.unit_flat",
  per_shipment: "price.unit_per_shipment",
};
const quantityText: Partial<Record<PortalPriceUnit, PortalTextKey>> = {
  per_kg: "price.quantity_per_kg",
  per_cbm: "price.quantity_per_cbm",
  per_tonne: "price.quantity_per_tonne",
  per_container: "price.quantity_per_container",
};

/** A customer's agreed lanes, priced as they type, and booked at that price in one step. */
export function PortalInstantPrice({ prices, locale, canBook }: { prices: PortalPriceCard[]; locale: PortalLocale; canBook: boolean }) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [cardId, setCardId] = useState(prices[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [timing, setTiming] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const card = prices.find((item) => item.id === cardId) ?? prices[0];
  if (!card) return null;
  const price = instantPrice(card, quantity);
  const needsQuantity = priceNeedsQuantity(card.unit);

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (price === null || !card) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/portal/prices/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rateCardId: card.id, quantity: needsQuantity ? Number(quantity) : null, timing, requirements: note }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; reference?: string; price?: number; currency?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "");
      setNotice({ text: t("price.booked", { amount: portalMoney(data.price ?? price, data.currency ?? card.currency), reference: data.reference ?? "" }), tone: "success" });
      setQuantity(""); setTiming(""); setNote("");
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error && error.message ? error.message : "The request couldn’t be sent.", tone: "danger" }); }
    finally { setBusy(false); }
  }

  return <OpsSurface title={t("price.title")} description={t("price.lead")}>
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    <form onSubmit={book} className="portal-form" aria-busy={busy}>
      <div className="portal-form-grid">
        <OpsField label={t("price.lane")}><select value={card.id} onChange={(event) => { setCardId(event.target.value); setQuantity(""); }}>{prices.map((item) => <option key={item.id} value={item.id}>{item.origin} → {item.destination}{item.service ? ` · ${item.service}` : ""}</option>)}</select></OpsField>
        {needsQuantity ? <OpsField label={t(quantityText[card.unit] ?? "price.quantity_per_kg")}><input required inputMode={card.unit === "per_container" ? "numeric" : "decimal"} value={quantity} onChange={(event) => setQuantity(event.target.value)}/></OpsField> : null}
      </div>
      <p className="portal-footnote m-0">
        {`${portalMoney(card.sell_rate, card.currency)} ${t(unitText[card.unit])}`}
        {card.minimum_charge ? ` · ${t("price.minimum", { amount: portalMoney(card.minimum_charge, card.currency) })}` : ""}
        {card.valid_until ? ` · ${t("price.valid_until", { date: portalDate(card.valid_until) })}` : ""}
      </p>
      <div className="portal-price-total" aria-live="polite">
        <span>{t("price.total")}</span>
        <strong>{price === null ? "—" : portalMoney(price, card.currency)}</strong>
      </div>
      <p className="portal-footnote m-0">{t("price.plus_vat")}</p>
      {canBook ? <>
        <div className="portal-form-grid">
          <OpsField label={t("price.timing")}><input value={timing} maxLength={200} onChange={(event) => setTiming(event.target.value)}/></OpsField>
          <OpsField label={t("price.note")}><input value={note} maxLength={1500} onChange={(event) => setNote(event.target.value)}/></OpsField>
        </div>
        <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy || price === null}><Zap size={13} aria-hidden="true"/>{t("price.book")}</OpsButton></div>
      </> : null}
    </form>
  </OpsSurface>;
}
