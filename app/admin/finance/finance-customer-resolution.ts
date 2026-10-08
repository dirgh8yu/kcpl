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

/** The price the customer agreed for a shipment, which its invoice should start from. */
export type AgreedShipmentPrice = {
  amount: number;
  currency: string;
  /** "booking" when it is the sell price on the booked commercial version. */
  source: "booking" | "quote";
  quote_reference: string | null;
};
