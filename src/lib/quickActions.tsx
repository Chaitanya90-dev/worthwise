import type { ReactNode } from "react";
import {
  CalendarDays,
  Plus,
  Repeat,
  Upload,
  Wallet,
} from "lucide-react";
import { appPath } from "../app/paths";

export type QuickActionConfig = {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: ReactNode;
  shortcutLabel: string;
  shortcutKey: string;
};

export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: "add-transaction",
    label: "Add transaction",
    description: "Record a spend or income.",
    to: appPath("/transactions?action=new"),
    icon: <Plus size={16} />,
    shortcutLabel: "1",
    shortcutKey: "1",
  },
  {
    id: "import-csv",
    label: "Import CSV",
    description: "Pull in a bank or card export.",
    to: appPath("/transactions?action=import"),
    icon: <Upload size={16} />,
    shortcutLabel: "2",
    shortcutKey: "2",
  },
  {
    id: "add-subscription",
    label: "Add subscription",
    description: "Track a recurring bill.",
    to: appPath("/subscriptions?action=new"),
    icon: <Repeat size={16} />,
    shortcutLabel: "3",
    shortcutKey: "3",
  },
  {
    id: "view-bills",
    label: "Bills calendar",
    description: "See upcoming recurring charges.",
    to: appPath("/bills"),
    icon: <CalendarDays size={16} />,
    shortcutLabel: "4",
    shortcutKey: "4",
  },
  {
    id: "set-budget",
    label: "Set budget",
    description: "Plan a category budget.",
    to: appPath("/budgets?action=new"),
    icon: <Wallet size={16} />,
    shortcutLabel: "5",
    shortcutKey: "5",
  },
];
