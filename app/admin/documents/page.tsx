import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import {
  documentVaultStorageConfigured,
  listVaultDocuments,
} from "./document-vault.server";
import { DocumentVaultWorkspace } from "./document-vault-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document Vault | KCPL Operations", robots: { index: false, follow: false } };

export default async function DocumentVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ shipment?: string; customer?: string }>;
}) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Document Vault is available only to authorised staff."/>;

  const staff = await getStaffContext(access.user);
  const query = await searchParams;
  const shipment = query.shipment?.trim() || "";
  const customer = query.customer?.trim() || "";
  const result = await listVaultDocuments(staff, { shipment, customer });
  if (result.kind !== "ready") return <Gate title="Document Vault unavailable" detail="Firebase is not available for this deployment."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <DocumentVaultWorkspace
        initialDocuments={result.documents}
        allowedBranches={staff.branches}
        defaultBranch={staff.branches[0] || "Kathmandu"}
        initialShipment={shipment}
        initialCustomer={customer}
        storageConfigured={documentVaultStorageConfigured()}
        canManageCustomerDocuments={staff.permissions.canManageCustomerDocuments}
        canDelete={staff.permissions.canManageCustomerDocuments || staff.permissions.role === "management"}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Document Vault</p><h1 className="mt-3 text-2xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><Link href="/admin" className="mt-5 inline-block rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Back to operations</Link></section></main>;
}
