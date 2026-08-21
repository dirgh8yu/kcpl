import type { CustomsClearanceStatus } from "./customs-policy";

export type CustomsClearanceRecord = {
  status: CustomsClearanceStatus;
  entry_point: string | null;
  declaration_reference: string | null;
  agent_partner_id: string | null;
  agent_name: string | null;
  hold_reason: string | null;
  release_evidence: string | null;
  released_at: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  updated_by_email: string | null;
};

export type CustomsClearanceInput = {
  status: CustomsClearanceStatus;
  entryPoint: string;
  declarationReference: string;
  agentPartnerId: string;
  holdReason: string;
  releaseEvidence: string;
};

export type CustomsAgentOption = {
  id: string;
  name: string;
};
