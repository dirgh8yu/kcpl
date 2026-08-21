import type { CrmCurrency, KcplBranch } from "../../crm/crm-data";
import type { PayableStatus } from "../../payables/payables-data";
import type { PartnerOwnerBranch } from "../partners-data";

export type SupplierLegacyIdentityKind = "name_only" | "customer_reference" | "invalid_reference" | "missing_partner";

export type SupplierReconciliationPartner = {
  id: string;
  name: string;
  owner_branch: PartnerOwnerBranch | null;
  status: string;
};

export type SupplierReconciliationSuggestion = {
  partner_id: string;
  partner_name: string;
  owner_branch: PartnerOwnerBranch | null;
  reason: "exact_name";
};

export type SupplierReconciliationBill = {
  reference: string;
  supplier_bill_reference: string | null;
  supplier_name: string;
  supplier_id: string | null;
  identity_kind: SupplierLegacyIdentityKind;
  branch: KcplBranch;
  status: PayableStatus;
  currency: CrmCurrency;
  total: number;
  balance_due: number;
  bill_date: string;
  due_date: string;
  shipment_reference: string | null;
  updated_at: string;
  suggestion: SupplierReconciliationSuggestion | null;
};

export type SupplierReconciliationSnapshot = {
  generated_at: string;
  bills: SupplierReconciliationBill[];
  partners: SupplierReconciliationPartner[];
  unresolved_count: number;
  exact_match_count: number;
  customer_reference_count: number;
  no_suggestion_count: number;
};
