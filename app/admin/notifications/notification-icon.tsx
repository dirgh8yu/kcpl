import { CircleDollarSign, FileText, ListTodo, MessageSquare, ShieldCheck, Truck, UserRoundCheck } from "lucide-react";
import type { OperationsNotification } from "./notification-data";

const icons = { assignments: UserRoundCheck, tasks: ListTodo, shipments: Truck, customs: ShieldCheck, documents: FileText, finance: CircleDollarSign, quotes: MessageSquare };

export function NotificationIcon({ category, severity, resolved = false }: Pick<OperationsNotification, "category" | "severity"> & { resolved?: boolean }) {
  const Icon = icons[category];
  return <span className="app-notification-icon" data-tone={resolved ? "neutral" : severity}><Icon size={17} strokeWidth={1.75} aria-hidden="true"/></span>;
}
