import type { KcplStaffRole } from "../../staff-permissions";
import type { ArchiveEntityType } from "./archive-data";

export type ArchiveRelationshipScope = "none" | "branch" | "organization";

/**
 * Only known organization-level entity types may bypass branch compatibility.
 * Missing/malformed branch data never promotes a branch-scoped entity to this scope.
 */
export function archiveRelationshipScope(entityType: ArchiveEntityType): ArchiveRelationshipScope {
  if (entityType === "general") return "none";
  if (entityType === "migration_batch") return "organization";
  return "branch";
}

export function canManagePaperArchive(role: KcplStaffRole) {
  return role === "management";
}

export function archiveLinkedRecordAllowed(input: {
  entityType: ArchiveEntityType;
  canonicalRecordExists: boolean;
  branchCompatible?: boolean;
}) {
  if (!input.canonicalRecordExists) return false;
  const scope = archiveRelationshipScope(input.entityType);
  if (scope === "none") return true;
  if (scope === "organization") return true;
  return input.branchCompatible === true;
}
