import type { CrmCurrency } from "./crm-data";

export const crmRateModes = ["air", "sea", "road", "multimodal"] as const;
export type CrmRateMode = (typeof crmRateModes)[number];

export const crmRateUnits = ["flat", "per_kg", "per_cbm", "per_tonne", "per_container", "per_shipment"] as const;
export type CrmRateUnit = (typeof crmRateUnits)[number];

export const crmRateUnitLabels: Record<CrmRateUnit, string> = {
  flat: "Flat rate",
  per_kg: "Per kg",
  per_cbm: "Per CBM",
  per_tonne: "Per tonne",
  per_container: "Per container",
  per_shipment: "Per shipment",
};

export type CrmRateCard = {
  id: string;
  customer_id: string;
  origin: string;
  destination: string;
  mode: CrmRateMode;
  carrier: string | null;
  service: string | null;
  currency: CrmCurrency;
  cost_rate: number | null;
  sell_rate: number;
  unit: CrmRateUnit;
  minimum_charge: number | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  active: boolean;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

export type CrmRateCardInput = {
  origin: string;
  destination: string;
  mode: CrmRateMode;
  carrier: string;
  service: string;
  currency: CrmCurrency;
  costRate: number | null;
  sellRate: number;
  unit: CrmRateUnit;
  minimumCharge: number | null;
  validFrom: string;
  validUntil: string;
  notes: string;
  active: boolean;
};
