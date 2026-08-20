export type NnswIntegrationState = {
  mode: "portal_bridge";
  apiAccessConfigured: boolean;
  label: string;
  detail: string;
  resources: Array<{ label: string; href: string; detail: string }>;
};

const NNSW_HOME = "https://nnsw.gov.np/trade/";
const NNSW_TARIFF = "https://nnsw.gov.np/trade/customs/tariff/search";
const NNSW_REGISTRATION = "https://nnsw.gov.np/trade/register/procedure?lang=en&navbarActive=tools";
const CUSTOMS_HOME = "https://customs.gov.np/";

/**
 * KCPL's customs integration boundary.
 *
 * Nepal Customs/NNSW publicly exposes trader/declarant portals and documents
 * system-to-system API connectivity for authorised participants, but KCPL does
 * not yet have a published trader API contract or credentials committed to the
 * application. Keep all future NECAS/NNSW calls behind this server-only module.
 */
export function getNnswIntegrationState(): NnswIntegrationState {
  const apiAccessConfigured = Boolean(
    process.env.NNSW_API_BASE_URL?.trim() && process.env.NNSW_API_TOKEN?.trim(),
  );

  return {
    mode: "portal_bridge",
    apiAccessConfigured,
    label: apiAccessConfigured ? "Credentials detected — connector contract pending" : "Portal bridge active",
    detail: apiAccessConfigured
      ? "KCPL has NNSW configuration present, but automated customs sync remains disabled until an authorised API contract and endpoint schema are confirmed."
      : "KCPL staff can operate the customs workflow inside Job Files and open official NNSW/NECAS tools from the Customs Desk. Automated sync will be enabled only after authorised API access is confirmed.",
    resources: [
      { label: "NNSW", href: NNSW_HOME, detail: "Trader and declarant services" },
      { label: "Tariff search", href: NNSW_TARIFF, detail: "Official customs tariff lookup" },
      { label: "NNSW registration", href: NNSW_REGISTRATION, detail: "Trader account requirements and procedure" },
      { label: "Department of Customs", href: CUSTOMS_HOME, detail: "NECAS and customs services" },
    ],
  };
}
