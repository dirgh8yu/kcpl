export type FinanceCustomerSuggestion = {
  id: string;
  display_name: string;
  reason: string;
};

export type FinanceCustomerResolution =
  | { kind: "resolved"; customerId: string; customerName: string }
  | { kind: "unlinked"; quoteReference: string | null; suggestions: FinanceCustomerSuggestion[] }
  | { kind: "shipment_missing" }
  | { kind: "unavailable" }
  | { kind: "not_requested" };
