import { Check, TriangleAlert } from "lucide-react";
import { portalStatusLabel } from "./portal-format";
import { portalTranslator, type PortalLocale } from "./portal-i18n";
import { portalTrackPosition, portalTrackState, portalTrackStepKeys, portalTrackSteps } from "./portal-track";

/** The journey under a shipment's title: six steps, the current one ringed.
 *  It is drawn where it stands. Progress is data, and it does not animate. */
export function PortalShipmentTrack({ status, locale, note }: { status: string; locale: PortalLocale; note?: string | null }) {
  const t = portalTranslator(locale);
  const position = portalTrackPosition(status);

  // No step to ring: say what is wrong. KCPL's note is the reason when there
  // is one; the general line stands in only when there is not.
  if (position < 0) {
    return (
      <div className="portal-track-alert">
        <TriangleAlert size={16} strokeWidth={2} aria-hidden="true"/>
        <p>
          <strong>{portalStatusLabel(status, locale)}.</strong>{" "}
          {note ? <span className="portal-track-alert-note">{note}</span> : t("mail.status_exception")}
        </p>
      </div>
    );
  }

  const next = portalTrackSteps[position + 1];
  return (
    <div className="portal-track">
      <ol className="portal-track-steps" aria-label={t("track.label")}>
        {portalTrackSteps.map((step, index) => {
          const state = portalTrackState(index, position);
          return (
            <li key={step} data-state={state} aria-current={index === position ? "step" : undefined}>
              <span className="portal-track-dot" aria-hidden="true">
                {state === "done" ? <Check size={11} strokeWidth={3}/> : null}
              </span>
              <span className="portal-track-label">{t(portalTrackStepKeys[step])}</span>
              {state === "done" && index !== position ? <span className="portal-sr-only">{` (${t("track.done")})`}</span> : null}
            </li>
          );
        })}
      </ol>
      {/* Six labels do not fit a phone, so there the steps are drawn bare and
          this line names the current one. The list says the same to a screen
          reader, so the line is hidden from one. */}
      <p className="portal-track-caption" aria-hidden="true">
        <strong>{t(portalTrackStepKeys[portalTrackSteps[position]])}</strong>
        <span>{t("track.step_of", { step: position + 1, total: portalTrackSteps.length })}</span>
        {next ? <span>{t("track.next", { step: t(portalTrackStepKeys[next]) })}</span> : null}
      </p>
    </div>
  );
}

/** The same journey as a slim bar under a status badge in a list. The badge
 *  says the status in words; the bar only shows how far along it is, so it is
 *  hidden from screen readers. Delivered needs no bar, and an exception has no
 *  position to show. */
export function PortalTrackBar({ status }: { status: string }) {
  const position = portalTrackPosition(status);
  if (position < 0 || position === portalTrackSteps.length - 1) return null;
  return (
    <span className="portal-track-bar" aria-hidden="true">
      {portalTrackSteps.map((step, index) => <span key={step} data-filled={index <= position ? "" : undefined}/>)}
    </span>
  );
}
