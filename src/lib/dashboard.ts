import dayjs from "dayjs";
import type { Budget, Category, Transaction } from "../types/finance";
import { getNetExpenseCategoryKey, getNetExpenseDelta } from "./transactions";

export type PieDatum = { name: string; value: number };
export type DailyDatum = { day: string; value: number };

export type DashboardMetrics = {
  totalSpent: number;
  totalBudget: number;
  categoryTotals: Map<string, number>;
  dailyTotals: Map<string, number>;
  categoryBudgets: Map<string, number>;
  overallBudget: number | null;
};

export type BudgetWarning = {
  label: string;
  ratio: number;
  spent: number;
  budget: number;
};

export const buildCategoryMap = (categories: Category[]) =>
  new Map(categories.map((category) => [category.id, category.name]));

export const calculateDashboardMetrics = (
  transactions: Transaction[],
  budgets: Budget[]
): DashboardMetrics => {
  const totals = new Map<string, number>();
  const daily = new Map<string, number>();
  let spent = 0;

  transactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    spent += delta;
    const categoryKey = getNetExpenseCategoryKey(tx);
    if (categoryKey) {
      totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + delta);
    }
    const dayKey = dayjs(tx.date).format("YYYY-MM-DD");
    daily.set(dayKey, (daily.get(dayKey) ?? 0) + delta);
  });

  const overall = budgets.find((budget) => !budget.category_id)?.amount ?? null;
  const budgetMap = new Map<string, number>();
  budgets
    .filter((budget) => budget.category_id)
    .forEach((budget) => {
      budgetMap.set(budget.category_id ?? "", budget.amount);
    });

  const budgetTotal =
    overall ?? Array.from(budgetMap.values()).reduce((sum, value) => sum + value, 0);

  const totalSpent = Math.max(0, spent);

  return {
    totalSpent,
    totalBudget: budgetTotal,
    categoryTotals: totals,
    dailyTotals: daily,
    categoryBudgets: budgetMap,
    overallBudget: overall,
  };
};

export const buildPieData = (
  categoryTotals: Map<string, number>,
  categoryMap: Map<string, string>
): PieDatum[] =>
  Array.from(categoryTotals.entries())
    .filter(([, value]) => value > 0)
    .map(([id, value]) => ({
      name: categoryMap.get(id) ?? "Uncategorized",
      value,
    }));

export const buildDailyData = (dailyTotals: Map<string, number>): DailyDatum[] =>
  Array.from(dailyTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => {
      const parsed = dayjs(day);
      return {
        day: parsed.isValid() ? parsed.format("DD MMM") : day,
        value: Math.max(0, value),
      };
    });

export const buildBudgetWarnings = ({
  overallBudget,
  totalSpent,
  categoryBudgets,
  categoryTotals,
  categoryMap,
  threshold = 0.8,
}: {
  overallBudget: number | null;
  totalSpent: number;
  categoryBudgets: Map<string, number>;
  categoryTotals: Map<string, number>;
  categoryMap: Map<string, string>;
  threshold?: number;
}): BudgetWarning[] => {
  const items: BudgetWarning[] = [];

  if (overallBudget && overallBudget > 0) {
    const safeTotal = Math.max(0, totalSpent);
    const ratio = safeTotal / overallBudget;
    if (ratio >= threshold) {
      items.push({
        label: "Overall budget",
        ratio,
        spent: safeTotal,
        budget: overallBudget,
      });
    }
  }

  categoryBudgets.forEach((budget, categoryId) => {
    if (budget <= 0) {
      return;
    }
    const spentRaw = categoryTotals.get(categoryId) ?? 0;
    const spent = Math.max(0, spentRaw);
    const ratio = spent / budget;
    if (ratio >= threshold) {
      items.push({
        label: categoryMap.get(categoryId) ?? "Uncategorized",
        ratio,
        spent,
        budget,
      });
    }
  });

  return items.sort((a, b) => b.ratio - a.ratio);
};
