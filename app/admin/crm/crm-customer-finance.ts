import type { CrmCurrency } from "./crm-data";

export type CrmCustomerFinanceSnapshot = {
  currency: CrmCurrency;
  revenue_total: number;
  cost_total: number;
  profit_total: number;
  gross_margin_percent: number;
  collected_total: number;
  outstanding_total: number;
  overdue_total: number;
  invoice_count: number;
  open_invoice_count: number;
  overdue_invoice_count: number;
  draft_invoice_count: number;
  oldest_overdue_days: number | null;
  other_currency_invoice_count: number;
  other_currency_cost_count: number;
  /** NRB rate date when other currencies were converted into this one. */
  rates_date: string | null;
  integrity_warning_count: number;
  /** Money KCPL holds for the customer, per currency: refundable or usable on an invoice. */
  account_credit: Array<{ currency: CrmCurrency; amount: number }>;
  generated_at: string;
};
