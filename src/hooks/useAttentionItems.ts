import { useMemo } from "react";
import dayjs from "dayjs";
import { appPath } from "../app/paths";
import type { BudgetWarning } from "../lib/dashboard";
import type { AttentionItem } from "../components/dashboard/AttentionStrip";

type UseAttentionItemsArgs = {
  hasBudgets: boolean;
  warnings: BudgetWarning[];
  overdueCount: number;
  dueSoonCount: number;
  subscriptionsCount: number;
  isLoading: boolean;
  transactionsCount: number;
  accountsCount: number;
  reconciliationMismatchCount: number;
  forecast?: {
    minBalance: number;
    minDate: string | null;
    firstNegativeDate: string | null;
    avgDailySpend: number;
  };
};

export const useAttentionItems = ({
  hasBudgets,
  warnings,
  overdueCount,
  dueSoonCount,
  subscriptionsCount,
  isLoading,
  transactionsCount,
  accountsCount,
  reconciliationMismatchCount,
  forecast,
}: UseAttentionItemsArgs) =>
  useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (!hasBudgets) {
      items.push({
        id: "no-budgets",
        title: "No budgets yet",
        description: "Set monthly budgets to unlock soft-cap alerts.",
        badge: "Budgets",
        tone: "blue",
        action: { label: "Set budgets", to: appPath("/budgets") },
      });
    } else if (warnings.length > 0) {
      items.push({
        id: "budget-warnings",
        title: "Spending near budget caps",
        description: `${warnings.length} categories are at 80% or higher.`,
        badge: `${warnings.length} caps`,
        tone: "orange",
        action: { label: "Review budgets", to: appPath("/budgets") },
      });
    }

    if (overdueCount > 0) {
      items.push({
        id: "overdue-subscriptions",
        title: "Overdue subscriptions",
        description: `${overdueCount} payments are past due.`,
        badge: `${overdueCount} overdue`,
        tone: "red",
        action: { label: "Review subscriptions", to: appPath("/subscriptions") },
      });
    } else if (dueSoonCount > 0) {
      items.push({
        id: "due-soon-subscriptions",
        title: "Subscriptions due soon",
        description: `${dueSoonCount} payments due within 7 days.`,
        badge: `${dueSoonCount} due`,
        tone: "yellow",
        action: { label: "Review subscriptions", to: appPath("/subscriptions") },
      });
    } else if (subscriptionsCount === 0) {
      items.push({
        id: "no-subscriptions",
        title: "No subscriptions tracked",
        description: "Add recurring bills to forecast renewals.",
        badge: "Subscriptions",
        tone: "blue",
        action: { label: "Add subscriptions", to: appPath("/subscriptions") },
      });
    }

    if (!isLoading && transactionsCount === 0) {
      items.push({
        id: "no-transactions",
        title: "No transactions this month",
        description: "Log expenses or import data to populate your dashboard.",
        badge: "Transactions",
        tone: "blue",
        action: { label: "Add transactions", to: appPath("/transactions") },
      });
    }

    if (reconciliationMismatchCount > 0) {
      items.push({
        id: "reconciliation-mismatch",
        title: "Reconciliation mismatch",
        description: `${reconciliationMismatchCount} account${
          reconciliationMismatchCount === 1 ? "" : "s"
        } differ from last statement.`,
        badge: `${reconciliationMismatchCount} mismatch${
          reconciliationMismatchCount === 1 ? "" : "es"
        }`,
        tone: "orange",
        action: { label: "Reconcile accounts", to: appPath("/settings") },
      });
    }

    if (accountsCount === 0) {
      items.push({
        id: "no-accounts",
        title: "No accounts connected",
        description: "Add bank, card, or cash balances to see coverage.",
        badge: "Accounts",
        tone: "blue",
        action: { label: "Add accounts", to: appPath("/settings") },
      });
    }

    if (forecast && forecast.avgDailySpend > 0) {
      const bufferTarget = forecast.avgDailySpend * 7;
      if (forecast.firstNegativeDate) {
        const formatted = dayjs(forecast.firstNegativeDate).format("DD MMM");
        items.push({
          id: "cash-runway-negative",
          title: "Cash runway turns negative",
          description: `Projected balance dips below 0 on ${formatted}.`,
          badge: "Runway",
          tone: "red",
          action: { label: "Review cashflow", to: appPath("/cashflow") },
        });
      } else if (forecast.minBalance < bufferTarget && forecast.minDate) {
        const formatted = dayjs(forecast.minDate).format("DD MMM");
        items.push({
          id: "cash-runway-buffer",
          title: "Cash runway is thin",
          description: `Balance drops below a 7-day buffer on ${formatted}.`,
          badge: "Runway",
          tone: "yellow",
          action: { label: "Review cashflow", to: appPath("/cashflow") },
        });
      }
    }

    return items;
  }, [
    accountsCount,
    dueSoonCount,
    hasBudgets,
    isLoading,
    overdueCount,
    reconciliationMismatchCount,
    subscriptionsCount,
    transactionsCount,
    warnings.length,
    forecast,
  ]);
