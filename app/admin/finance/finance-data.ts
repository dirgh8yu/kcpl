import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const financeInvoiceStatuses = ["draft", "issued", "partially_paid", "paid", "overdue", "void"] as const;
export type FinanceInvoiceStatus = (typeof financeInvoiceStatuses)[number];

export const financePaymentMethods = ["bank_transfer", "cash", "card", "cheque", "wallet", "adjustment", "other"] as const;
export type FinancePaymentMethod = (typeof financePaymentMethods)[number];

export type FinanceReceivableRecordType = "invoice" | "opening_balance";

export const financeInvoiceStatusLabels: Record<FinanceInvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const financePaymentMethodLabels: Record<FinancePaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  cheque: "Cheque",
  wallet: "Digital wallet",
  adjustment: "Adjustment",
  other: "Other",
};

export type FinanceInvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
};

export type FinancePayment = {
  id: string;
  invoice_reference: string;
  amount: number;
  currency: CrmCurrency;
  payment_date: string;
  method: FinancePaymentMethod;
  reference: string | null;
  notes: string | null;
  recorded_by_name: string;
  recorded_by_email: string;
  created_at: string;
};

export type FinanceInvoice = {
  reference: string;
  record_type: FinanceReceivableRecordType;
  external_invoice_number: string | null;
  migration_batch_id: string | null;
  migration_as_of_date: string | null;
  customer_id: string;
  customer_name: string;
  shipment_reference: string | null;
  quote_reference: string | null;
  branch: KcplBranch;
  status: FinanceInvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: CrmCurrency;
  line_items: FinanceInvoiceLine[];
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  payments: FinancePayment[];
};

export type FinanceCurrencySummary = {
  currency: CrmCurrency;
  invoiced: number;
  opening_balance: number;
  collected: number;
  outstanding: number;
  overdue: number;
  aging_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_90_plus: number;
  invoice_count: number;
  opening_balance_count: number;
};

export type FinanceDashboard = {
  generated_at: string;
  invoices: FinanceInvoice[];
  currency_summaries: FinanceCurrencySummary[];
  overdue_count: number;
  unpaid_count: number;
  paid_count: number;
  draft_count: number;
  opening_balance_count: number;
};

export type CreateFinanceInvoiceInput = {
  customerId: string;
  shipmentReference: string;
  issueDate: string;
  dueDate: string;
  currency: CrmCurrency;
  description: string;
  amount: number;
  taxRate: number;
  notes: string;
};
