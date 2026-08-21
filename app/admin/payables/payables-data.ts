import type { CrmCurrency, KcplBranch } from "../crm/crm-data";
import type { JobCostCategory } from "../job-file";
import type { FinancePaymentMethod } from "../finance/finance-data";

export const payableStatuses = ["draft", "approved", "partially_paid", "paid", "overdue", "void"] as const;
export type PayableStatus = (typeof payableStatuses)[number];
export type PayableRecordType = "bill" | "opening_balance";

export const payableStatusLabels: Record<PayableStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export type PayablePayment = {
  id: string;
  payable_reference: string;
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

export type PayableBill = {
  reference: string;
  record_type: PayableRecordType;
  supplier_id: string | null;
  supplier_name: string;
  supplier_bill_reference: string | null;
  shipment_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  branch: KcplBranch;
  category: JobCostCategory;
  status: PayableStatus;
  bill_date: string;
  due_date: string;
  currency: CrmCurrency;
  description: string;
  subtotal: number;
  tax_rate: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  migration_batch_id: string | null;
  migration_as_of_date: string | null;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  payments: PayablePayment[];
};

export type PayableCurrencySummary = {
  currency: CrmCurrency;
  billed: number;
  opening_balance: number;
  paid: number;
  outstanding: number;
  overdue: number;
  aging_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_90_plus: number;
  bill_count: number;
  opening_balance_count: number;
};

export type PayablesDashboard = {
  generated_at: string;
  bills: PayableBill[];
  currency_summaries: PayableCurrencySummary[];
  overdue_count: number;
  unpaid_count: number;
  paid_count: number;
  draft_count: number;
  opening_balance_count: number;
};

export type CreatePayableInput = {
  supplierId: string;
  supplierName: string;
  supplierBillReference: string;
  shipmentReference: string;
  branch: KcplBranch;
  billDate: string;
  dueDate: string;
  currency: CrmCurrency;
  category: JobCostCategory;
  description: string;
  amount: number;
  taxRate: number;
  notes: string;
};
