import { OpsBadge, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../../shipment-document-types";
import type { PortalAccessSummary } from "../../../portal/portal-access-log";

const timestamp = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kathmandu",
});

function when(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : timestamp.format(parsed);
}

function documentLabel(documentType: string) {
  return shipmentDocumentTypeLabels[documentType as ShipmentDocumentType] ?? "Document";
}

export type CustomerAccessPending = { id: number; document_type: string; filename: string };

/**
 * What the customer has actually collected.
 *
 * The two halves answer opposite questions. The table settles "we never
 * received it". The list beneath it is the one an operator can still act on:
 * released paperwork nobody has opened, while there is time to ring them.
 */
export function CustomerAccessPanel({
  summaries,
  pending,
  releasedCount,
}: {
  summaries: PortalAccessSummary[];
  pending: CustomerAccessPending[];
  releasedCount: number;
}) {
  const collected = summaries.length;

  return (
    <OpsSurface
      eyebrow="Customer portal"
      title="Document access"
      description={
        releasedCount
          ? `${collected} of ${releasedCount} released ${releasedCount === 1 ? "document has" : "documents have"} been downloaded by the customer.`
          : "No document on this shipment has been released to the customer yet."
      }
    >
      {summaries.length ? (
        <OpsTableWrap>
          <table className="ops-table ops-register-table job-access-table">
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Downloads</th>
                <th scope="col">Collected by</th>
                <th scope="col">Last download</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.document_id}>
                  <td>
                    <strong>{documentLabel(summary.document_type)}</strong>
                    <span className="portal-cell-detail">{summary.filename}</span>
                  </td>
                  <td>{summary.downloads}</td>
                  <td>
                    {summary.accounts.map((account) => (
                      <span key={account} className="portal-cell-detail">{account}</span>
                    ))}
                  </td>
                  <td>
                    {when(summary.last_at)}
                    <span className="portal-cell-detail">{summary.last_by}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpsTableWrap>
      ) : (
        // Quiet empty state: one left-aligned line. The surface description
        // already carries the context sentence, so no icon panel or reserved
        // height is needed here.
        <p className="job-access-quiet-empty">
          {releasedCount ? "Nothing downloaded yet" : "Nothing released yet"}
          <span>
            {releasedCount
              ? "The customer has not downloaded any of the documents released to them."
              : "Once a document is marked customer-safe, downloads from the portal are recorded here."}
          </span>
        </p>
      )}

      {pending.length ? (
        <div className="job-access-pending">
          <p>
            <OpsBadge tone="warning">Not collected</OpsBadge>
            <span>Released to the customer but never downloaded.</span>
          </p>
          <ul>
            {pending.map((document) => (
              <li key={document.id}>
                <strong>{documentLabel(document.document_type)}</strong>
                <span>{document.filename}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </OpsSurface>
  );
}
