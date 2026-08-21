import type { CrmAccountStatus, CrmRelationshipType } from "./crm-data";
import type { StaffCapabilities } from "../staff-permissions";

export function hasCustomerRelationship(types: readonly CrmRelationshipType[]) {
  return types.includes("customer");
}

export function crmAccountStatusChangeError(current: CrmAccountStatus, next: CrmAccountStatus, permissions: StaffCapabilities) {
  if (current === next) return null;
  if (current === "blacklisted" || next === "blacklisted") {
    return permissions.role === "management" ? null : "Only KCPL Management can blacklist or restore a blacklisted customer.";
  }
  if (current === "on_hold" || next === "on_hold") {
    return permissions.canManageCredit ? null : "Accounts or Management approval is required to place or remove a customer credit hold.";
  }
  return null;
}

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeNepalDateTimeInput(value: string) {
  const input = value.trim();
  if (!input) return "";

  const local = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = local;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
      naiveUtc.getUTCFullYear() !== year ||
      naiveUtc.getUTCMonth() !== month - 1 ||
      naiveUtc.getUTCDate() !== day ||
      naiveUtc.getUTCHours() !== hour ||
      naiveUtc.getUTCMinutes() !== minute ||
      naiveUtc.getUTCSeconds() !== second
    ) return null;
    return new Date(naiveUtc.getTime() - 345 * 60_000).toISOString();
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
