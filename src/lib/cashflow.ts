import dayjs from "dayjs";
import type { Tag, Transaction } from "../types/finance";
import {
  getIncomeDelta,
  getNetExpenseCategoryKey,
  getNetExpenseDelta,
} from "./transactions";

export type WeeklyDatum = {
  week: string;
  income: number;
  expense: number;
  net: number;
};

export type CategorySummary = {
  id: string;
  name: string;
  value: number;
};

export type CashflowMetrics = {
  totalIncome: number;
  totalExpense: number;
  net: number;
  incomeCount: number;
  expenseCount: number;
  weeklyData: WeeklyDatum[];
  topExpenseCategories: CategorySummary[];
  topIncomeCategories: CategorySummary[];
};

export type CategoryRow = {
  id: string;
  category: string;
  amount: number;
  share: number;
};

export const filterTransactions = (
  transactions: Transaction[],
  paymentFilter: string,
  tagFilter: string
) =>
  transactions.filter((tx) => {
    if (tx.is_transfer) {
      return false;
    }
    const matchesPayment = paymentFilter
      ? tx.payment_method_id === paymentFilter
      : true;
    const matchesTag = tagFilter
      ? tx.tags?.some((tag) => tag.id === tagFilter)
      : true;
    return matchesPayment && matchesTag;
  });

export const buildTagOptions = (transactions: Transaction[]) => {
  const map = new Map<string, Tag>();
  transactions.forEach((tx) => {
    tx.tags?.forEach((tag) => {
      if (!map.has(tag.id)) {
        map.set(tag.id, tag);
      }
    });
  });
  return Array.from(map.values()).map((tag) => ({ id: tag.id, name: tag.name }));
};

export const calculateCashflowMetrics = ({
  transactions,
  month,
  categoryMap,
}: {
  transactions: Transaction[];
  month: string;
  categoryMap: Map<string, string>;
}): CashflowMetrics => {
  const expensesByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();
  let income = 0;
  let expense = 0;
  let incomeItems = 0;
  let expenseItems = 0;

  const start = dayjs(`${month}-01`);
  const weeksInMonth = Math.ceil(start.daysInMonth() / 7);
  const weekly = Array.from({ length: weeksInMonth }, (_, index) => ({
    week: `Week ${index + 1}`,
    income: 0,
    expense: 0,
    net: 0,
  }));

  transactions.forEach((tx) => {
    const dayIndex = dayjs(tx.date).date();
    const weekIndex = Math.floor((dayIndex - 1) / 7);
    const bucket = weekly[weekIndex];
    if (!bucket) {
      return;
    }
    const incomeDelta = getIncomeDelta(tx);
    if (incomeDelta !== 0) {
      income += incomeDelta;
      incomeItems += 1;
      bucket.income += incomeDelta;
      const incomeCategoryKey = tx.category_id ?? "uncategorized";
      incomeByCategory.set(
        incomeCategoryKey,
        (incomeByCategory.get(incomeCategoryKey) ?? 0) + incomeDelta
      );
    }

    const expenseDelta = getNetExpenseDelta(tx);
    if (expenseDelta !== 0) {
      expense += expenseDelta;
      if (tx.type === "expense") {
        expenseItems += 1;
      }
      bucket.expense += expenseDelta;
      const expenseCategoryKey = getNetExpenseCategoryKey(tx);
      if (expenseCategoryKey) {
        expensesByCategory.set(
          expenseCategoryKey,
          (expensesByCategory.get(expenseCategoryKey) ?? 0) + expenseDelta
        );
      }
    }
  });

  weekly.forEach((bucket) => {
    bucket.net = bucket.income - bucket.expense;
  });

  const topExpense = Array.from(expensesByCategory.entries())
    .filter(([, value]) => value > 0)
    .map(([id, value]) => ({
      id,
      name: categoryMap.get(id) ?? "Uncategorized",
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topIncome = Array.from(incomeByCategory.entries())
    .map(([id, value]) => ({
      id,
      name: categoryMap.get(id) ?? "Uncategorized",
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    totalIncome: income,
    totalExpense: expense,
    net: income - expense,
    incomeCount: incomeItems,
    expenseCount: expenseItems,
    weeklyData: weekly,
    topExpenseCategories: topExpense,
    topIncomeCategories: topIncome,
  };
};

export const buildCategoryRows = (
  items: CategorySummary[],
  total: number
): CategoryRow[] =>
  items.map((item) => ({
    id: item.id,
    category: item.name,
    amount: item.value,
    share: total ? Math.round((item.value / total) * 100) : 0,
  }));
