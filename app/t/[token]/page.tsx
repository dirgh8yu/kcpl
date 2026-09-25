import Image from "next/image";
import { headers } from "next/headers";
import { portalModeLabel, portalStatusLabel } from "../../portal/portal-format";
import type { PortalLocale } from "../../portal/portal-i18n";
import { readPublicTracking } from "../../tracking/public-tracking.server";

export const dynamic = "force-dynamic";

function when(value: string | null, locale: PortalLocale, withTime = false) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" } : { timeZone: "UTC" }),
  }).format(date);
}

const copy = {
  en: {
    expected: "Expected",
    delivered: "Delivered",
    now: "Now at",
    updated: "Last update",
    milestones: "Milestones",
    none: "No milestones yet.",
    gone: "This link has expired or was withdrawn",
    goneBody: "Ask the person who shared it for a new one.",
    footer: "Shared from KCPL by the shipper. Kapileshwor Cargo Pvt. Ltd.",
  },
  ne: {
    expected: "अपेक्षित",
    delivered: "डेलिभर भयो",
    now: "अहिले",
    updated: "अन्तिम अद्यावधिक",
    milestones: "प्रगति",
    none: "अहिलेसम्म कुनै प्रगति छैन।",
    gone: "यो लिङ्कको म्याद सकियो वा फिर्ता लिइयो",
    goneBody: "सेयर गर्ने व्यक्तिसँग नयाँ लिङ्क माग्नुहोस्।",
    footer: "पठाउनेले KCPL बाट सेयर गरेको। कपिलेश्वर कार्गो प्रा. लि.",
  },
};

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale: PortalLocale = /^ne\b/i.test((await headers()).get("accept-language") ?? "") ? "ne" : "en";
  const t = copy[locale];
  const view = await readPublicTracking(token);

  if (!view) {
    return (
      <main className="kcpl-track">
        <header className="kcpl-track-head"><Image src="/images/brand/kcpl-gateway-k.svg" alt="KCPL" width={28} height={28} /></header>
        <section className="kcpl-track-card kcpl-track-gone">
          <h1>{t.gone}</h1>
          <p>{t.goneBody}</p>
        </section>
      </main>
    );
  }

  const delivered = view.status === "delivered";
  const lastMilestone = view.milestones[0];
  return (
    <main className="kcpl-track">
      <header className="kcpl-track-head">
        <Image src="/images/brand/kcpl-gateway-k.svg" alt="KCPL" width={28} height={28} />
        <span>{view.reference}</span>
      </header>

      <section className="kcpl-track-card">
        <p className="kcpl-track-mode">{portalModeLabel(view.mode, locale)}</p>
        <h1 className="kcpl-track-route">
          <span>{view.origin || "—"}</span>
          <span aria-hidden="true" className="kcpl-track-arrow">→</span>
          <span>{view.destination || "—"}</span>
        </h1>
        <p className={`kcpl-track-status${view.status === "exception" ? " is-attention" : ""}`}>{portalStatusLabel(view.status, locale)}</p>
        <div className="kcpl-track-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.progress * 100)}>
          <span style={{ width: `${Math.round(view.progress * 100)}%` }} />
        </div>
        <dl className="kcpl-track-facts">
          {delivered ? (
            <div><dt>{t.delivered}</dt><dd>{when(lastMilestone?.at ?? view.updated_at, locale) ?? "—"}</dd></div>
          ) : (
            <div><dt>{t.expected}</dt><dd>{when(view.eta, locale) ?? "—"}</dd></div>
          )}
          {view.current_location ? <div><dt>{t.now}</dt><dd>{view.current_location}</dd></div> : null}
          <div><dt>{t.updated}</dt><dd>{when(view.updated_at, locale, true) ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="kcpl-track-card">
        <h2>{t.milestones}</h2>
        {view.milestones.length === 0 ? <p className="kcpl-track-muted">{t.none}</p> : (
          <ol className="kcpl-track-steps">
            {view.milestones.map((step, index) => (
              <li key={`${step.at}-${index}`} className={index === 0 ? "is-latest" : undefined}>
                <strong>{step.title}</strong>
                <span>{[when(step.at, locale, true), step.location].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="kcpl-track-foot">{t.footer}</footer>
    </main>
  );
}
