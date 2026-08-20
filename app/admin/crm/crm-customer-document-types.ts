export const crmCustomerDocumentTypes = [
  "pan_vat",
  "kyc",
  "contract",
  "credit_agreement",
  "rate_sheet",
  "standing_instruction",
  "identity_document",
  "other",
] as const;

export type CrmCustomerDocumentType = (typeof crmCustomerDocumentTypes)[number];

export const crmCustomerDocumentTypeLabels: Record<CrmCustomerDocumentType, string> = {
  pan_vat: "PAN / VAT certificate",
  kyc: "KYC document",
  contract: "Contract / agreement",
  credit_agreement: "Credit agreement",
  rate_sheet: "Rate sheet",
  standing_instruction: "Standing instruction",
  identity_document: "Identity document",
  other: "Other document",
};

export type CrmCustomerDocument = {
  id: number;
  customer_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  document_type: CrmCustomerDocumentType;
  uploaded_at: string;
  uploaded_by: string;
};
