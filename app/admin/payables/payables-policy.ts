import { isPartnerReference } from "../partners/partner-policy";

export function validPayableCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function payableDateError(billDate: string, dueDate: string) {
  if (!validPayableCalendarDate(billDate)) return "Choose a real supplier bill date.";
  if (!validPayableCalendarDate(dueDate)) return "Choose a real supplier bill due date.";
  if (dueDate < billDate) return "Supplier bill due date cannot be before the bill date.";
  return null;
}

export function normalizeSupplierBillReference(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeSupplierName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function supplierIdentityKey(supplierId: string, supplierName: string) {
  const normalizedId = supplierId.trim().toUpperCase();
  if (isPartnerReference(normalizedId)) return normalizedId;
  const normalizedName = normalizeSupplierName(supplierName);
  return normalizedName ? `NAME:${normalizedName}` : "";
}
