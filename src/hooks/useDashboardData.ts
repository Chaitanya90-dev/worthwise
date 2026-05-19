import { useMemo } from "react";
import dayjs from "dayjs";
import {
  useGetBudgetsQuery,
  useGetCategoriesQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { formatMonthLabel } from "../lib/format";
import {
  buildBudgetWarnings,
  buildDailyData,
  buildPieData,
  calculateDashboardMetrics,
} from "../lib/dashboard";
import {
  buildCategoryDisplayMap,
  buildCategoryLookup,
  rollupCategoryTotals,
} from "../lib/categories";
import { useGetFundsQuery } from "../features/api/fundsApi";

type Options = {
  selectedMonth?: string;
  rollupCategories?: boolean;
};

export const useDashboardData = (options: Options = {}) => {
  const { selectedMonth, rollupCategories = false } = options;
  const month = selectedMonth ?? dayjs().format("YYYY-MM");
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: budgets = [] } = useGetBudgetsQuery(month);
  const { data: transactions = [], isLoading } = useGetTransactionsQuery({
    month,
  });
  const { data: funds = [] } = useGetFundsQuery();
  const activeFunds = useMemo(
    () => funds.filter((fund) => !fund.is_archived),
    [funds]
  );

  const categoryLookup = useMemo(
    () => buildCategoryLookup(categories),
    [categories]
  );
  const categoryMap = useMemo(
    () => buildCategoryDisplayMap(categories, rollupCategories),
    [categories, rollupCategories]
  );
  const metrics = useMemo(
    () => calculateDashboardMetrics(transactions, budgets),
    [transactions, budgets]
  );
  const pieTotals = useMemo(
    () =>
      rollupCategories
        ? rollupCategoryTotals(metrics.categoryTotals, categoryLookup)
        : metrics.categoryTotals,
    [rollupCategories, metrics.categoryTotals, categoryLookup]
  );
  const pieData = useMemo(
    () => buildPieData(pieTotals, categoryMap),
    [pieTotals, categoryMap]
  );
  const dailyData = useMemo(
    () => buildDailyData(metrics.dailyTotals),
    [metrics.dailyTotals]
  );
  const warnings = useMemo(
    () =>
      buildBudgetWarnings({
        overallBudget: metrics.overallBudget,
        totalSpent: metrics.totalSpent,
        categoryBudgets: metrics.categoryBudgets,
        categoryTotals: metrics.categoryTotals,
        categoryMap,
      }),
    [
      metrics.overallBudget,
      metrics.totalSpent,
      metrics.categoryBudgets,
      metrics.categoryTotals,
      categoryMap,
    ]
  );

  const remaining = metrics.totalBudget - metrics.totalSpent;
  const hasBudgets = budgets.length > 0;
  return {
    month,
    monthLabel,
    categories,
    budgets,
    transactions,
    isLoading,
    hasBudgets,
    categoryMap,
    pieData,
    dailyData,
    warnings,
    remaining,
    funds: activeFunds,
    ...metrics,
  };
};
