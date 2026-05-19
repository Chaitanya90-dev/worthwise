import { useMemo } from "react";
import type { BudgetWarning } from "../lib/dashboard";
import { formatINR } from "../lib/format";

type UseWeeklyCheckInArgs = {
  transactionsCount: number;
  totalBudget: number;
  totalSpent: number;
  categoryTotals: Map<string, number>;
  categoryBudgets: Map<string, number>;
  categoryMap: Map<string, string>;
  avgDailySpend: number;
  incomeTotal: number;
  expenseTotal: number;
  hasBudgets: boolean;
  warnings: BudgetWarning[];
  dueSoonSubscriptionsCount: number;
};

export const useWeeklyCheckIn = ({
  transactionsCount,
  totalBudget,
  totalSpent,
  categoryTotals,
  categoryBudgets,
  categoryMap,
  avgDailySpend,
  incomeTotal,
  expenseTotal,
  hasBudgets,
  warnings,
  dueSoonSubscriptionsCount,
}: UseWeeklyCheckInArgs) => {
  const topCategory = useMemo(() => {
    let topId = "";
    let topValue = 0;
    categoryTotals.forEach((value, id) => {
      if (value > topValue) {
        topValue = value;
        topId = id;
      }
    });
    if (!topId || topValue <= 0) {
      return null;
    }
    return {
      label: categoryMap.get(topId) ?? "Uncategorized",
      value: topValue,
    };
  }, [categoryTotals, categoryMap]);

  const bestBudgetHeadroom = useMemo(() => {
    let bestId = "";
    let bestRemaining = 0;
    categoryBudgets.forEach((budget, id) => {
      const spent = categoryTotals.get(id) ?? 0;
      const remainingBudget = budget - spent;
      if (remainingBudget > bestRemaining) {
        bestRemaining = remainingBudget;
        bestId = id;
      }
    });
    if (!bestId || bestRemaining <= 0) {
      return null;
    }
    return {
      label: categoryMap.get(bestId) ?? "Uncategorized",
      amount: bestRemaining,
    };
  }, [categoryBudgets, categoryTotals, categoryMap]);

  const insights = useMemo(() => {
    const items: string[] = [];

    if (transactionsCount === 0) {
      items.push("No transactions logged yet this month.");
    } else if (totalBudget > 0) {
      const ratio = totalSpent / totalBudget;
      if (ratio > 1) {
        items.push(
          `Overall spend is ${formatINR(totalSpent)} vs budget ${formatINR(
            totalBudget
          )} (${formatINR(totalSpent - totalBudget)} over).`
        );
      } else {
        items.push(
          `Overall spend is ${Math.round(ratio * 100)}% of your ${formatINR(
            totalBudget
          )} budget.`
        );
      }
    } else if (totalSpent > 0) {
      items.push(`Total spend is ${formatINR(totalSpent)} so far this month.`);
    }

    if (topCategory) {
      items.push(
        `Top category is ${topCategory.label} at ${formatINR(topCategory.value)}.`
      );
    }

    if (avgDailySpend > 0) {
      items.push(`Average daily spend is ${formatINR(avgDailySpend)}.`);
    }

    const net = incomeTotal - expenseTotal;
    if (incomeTotal > 0 || expenseTotal > 0) {
      items.push(
        `Net cashflow is ${net >= 0 ? "+" : "-"}${formatINR(
          Math.abs(net)
        )} so far this month.`
      );
    }

    const unique = items.filter((item, index) => items.indexOf(item) === index);

    while (unique.length < 2) {
      unique.push("Log a few transactions to unlock deeper insights.");
    }

    return unique.slice(0, 2);
  }, [
    transactionsCount,
    totalBudget,
    totalSpent,
    topCategory,
    avgDailySpend,
    incomeTotal,
    expenseTotal,
  ]);

  const nudge = useMemo(() => {
    if (transactionsCount === 0) {
      return "Import or add transactions to personalize your weekly check-in.";
    }

    if (!hasBudgets) {
      return "Set your first budget to unlock alerts and weekly guidance.";
    }

    if (warnings.length > 0) {
      const warning = warnings[0];
      const overBy = warning.spent - warning.budget;
      const label =
        warning.label === "Overall budget" ? "overall budget" : warning.label;

      if (overBy > 0) {
        if (bestBudgetHeadroom && warning.label !== "Overall budget") {
          const shiftAmount = Math.min(overBy, bestBudgetHeadroom.amount);
          return `You're over in ${label} by ${formatINR(
            overBy
          )}. Shift ${formatINR(shiftAmount)} from ${
            bestBudgetHeadroom.label
          } to stay on track.`;
        }
        return `You're over your ${label} by ${formatINR(
          overBy
        )}. Trim one discretionary expense this week.`;
      }

      return `You're at ${Math.round(
        warning.ratio * 100
      )}% of your ${label}. Keep spending tight this week.`;
    }

    if (dueSoonSubscriptionsCount > 0) {
      return `You have ${dueSoonSubscriptionsCount} subscriptions due in the next 7 days. Post them to keep data current.`;
    }

    if (incomeTotal - expenseTotal < 0) {
      return "Net cashflow is negative this month. Pause one non-essential expense this week.";
    }

    return "Keep logging expenses and reviewing budgets each week.";
  }, [
    bestBudgetHeadroom,
    dueSoonSubscriptionsCount,
    hasBudgets,
    incomeTotal,
    expenseTotal,
    transactionsCount,
    warnings,
  ]);

  return { insights, nudge };
};
