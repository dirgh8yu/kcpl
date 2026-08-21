import type { ReactNode } from "react";
import { OperationsNotificationBridge } from "./operations-notification-bridge";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}<OperationsNotificationBridge/></>;
}
