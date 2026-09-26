export const DOCUMENT_SHIPMENT_PAGE_SIZE = 40;

export function documentPageOffset(raw: string | null): number | null {
  if (raw === null) return 0;
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const offset = Number(raw);
  return Number.isSafeInteger(offset) && offset <= 500 ? offset : null;
}
