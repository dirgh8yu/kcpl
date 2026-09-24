import "../organisation-premium.css";
import "./gallery-workspace.css";
import { getAdminAccess } from "../admin-auth";
import { AdminLoginPage } from "../admin-login-page";
import { getStaffContext } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { galleryStorageAvailable, listGalleryEntries } from "../../site-gallery.server";
import { GalleryWorkspace } from "./gallery-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website Gallery · KCPL Operations", robots: { index: false, follow: false } };

export default async function AdminGalleryPage() {
  const access = await getAdminAccess();
  if (access.kind === "unconfigured") return <V4WorkspaceGate title="KCPL admin access needs configuration" detail="Gallery management requires the Firebase admin runtime." />;
  if (access.kind === "signed-out") return <AdminLoginPage />;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (staff.permissions.role !== "management") return <OperationsShell {...shellProps}><V4WorkspaceGate embedded title="Management access required" detail="Publishing images on the public website is restricted to KCPL Management." /></OperationsShell>;
  if (!galleryStorageAvailable()) return <OperationsShell {...shellProps}><V4WorkspaceGate embedded title="Image storage is unavailable" detail="Configure the Firebase Storage bucket for this deployment before uploading gallery images." /></OperationsShell>;

  let entries;
  try {
    entries = await listGalleryEntries();
  } catch (error) {
    console.error("Could not load KCPL gallery manager", error);
    return <OperationsShell {...shellProps}><V4WorkspaceGate embedded title="Gallery manager is unavailable" detail="The image list could not be loaded. Please try again shortly." /></OperationsShell>;
  }
  return <OperationsShell {...shellProps}><GalleryWorkspace initialItems={entries ?? []} /></OperationsShell>;
}
