/**
 * One key per payment the person means to record. A retry of the same
 * submission (a lost response, a second click after an error) reuses it, so
 * the server records the money once; the form takes a new key after a
 * payment goes through, so the next payment of the same amount is its own.
 */
export function newPaymentKey() {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `staff-${random}`;
}
