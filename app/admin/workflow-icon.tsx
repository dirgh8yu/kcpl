import {
  Archive, ArrowDownLeft, ArrowUpRight, Building2, CalendarClock, ChartNoAxesCombined,
  ChartNoAxesColumn, CircleDollarSign, ClipboardCheck, Container, FileCheck2,
  FileText, FolderOpen, Globe2, Inbox, LayoutDashboard, ListTodo, MessagesSquare,
  PlugZap, Radar, Scale, ShieldCheck, Truck, UsersRound, Waypoints, type LucideIcon,
} from "lucide-react";
import type { WorkspaceIconName } from "./workflow-navigation";

// Registry keys remain stable; each destination has a literal symbol.
const workspaceIcons: Record<WorkspaceIconName, LucideIcon> = {
  Home: LayoutDashboard, Truck, Calendar: CalendarClock, FileText,
  Map: Radar, Shield: ShieldCheck, Folder: FolderOpen, CheckSquare: FileCheck2,
  Bell: ListTodo, BellRing: Inbox, MessageSquare: MessagesSquare, Users: Building2,
  TrendingUp: ChartNoAxesCombined, BarChart3: ChartNoAxesColumn, Tag: CircleDollarSign,
  Layers: Container, ClipboardList: ClipboardCheck, Globe: Globe2, Zap: PlugZap,
  Network: Waypoints, CreditCard: ArrowDownLeft, Receipt: ArrowUpRight,
  Scale, BarChart2: ChartNoAxesCombined, Database: Archive, Users2: UsersRound,
};

export function WorkspaceIcon({ name, size = 17 }: { name: WorkspaceIconName; size?: number }) {
  const Icon = workspaceIcons[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true"/>;
}
