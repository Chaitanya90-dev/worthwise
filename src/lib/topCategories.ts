import type { Transaction, Category } from "../types/finance";
import { getNetExpenseCategoryKey, getNetExpenseDelta } from "./transactions";

export const buildTopCategories = (
  transactions: Transaction[],
  categories: Category[],
  limit = 5
) => {
  const nameMap = new Map(categories.map((cat) => [cat.id, cat.name]));
  const totals = new Map<string, number>();

  transactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    const key = getNetExpenseCategoryKey(tx) ?? "uncategorized";
    totals.set(key, (totals.get(key) ?? 0) + delta);
  });

  return Array.from(totals.entries())
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({
      id,
      name: nameMap.get(id) ?? "Uncategorized",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
};
