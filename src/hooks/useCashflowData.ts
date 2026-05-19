import { useMemo } from "react";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { buildDisplayTransactions } from "../lib/displayTransactions";
import { formatMonthLabel } from "../lib/format";
import {
  buildCategoryRows,
  buildTagOptions,
  calculateCashflowMetrics,
} from "../lib/cashflow";
import {
  filterTransactions as filterDisplayTransactions,
  type TransactionFilterState,
} from "../lib/transactionFilters";

export const useCashflowData = ({
  month,
  filters,
}: {
  month: string;
  filters: TransactionFilterState;
}) => {
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: transactions = [], isLoading: isTransactionsLoading } =
    useGetTransactionsQuery({ month });

  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
  const accountCurrencyMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.currency])),
    [accounts]
  );

  const paymentOptions = useMemo(
    () => [
      { value: "none", label: "No payment method" },
      ...paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    ],
    [paymentMethods]
  );
  const accountOptions = useMemo(
    () => [
      { value: "none", label: "No linked account" },
      ...accounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    ],
    [accounts]
  );
  const categoryOptions = useMemo(
    () => [
      { value: "uncategorized", label: "Uncategorized" },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories]
  );

  const displayTransactions = useMemo(
    () =>
      buildDisplayTransactions({
        transactions,
        categoryMap,
        accountMap,
        accountCurrencyMap,
        paymentMap,
      }),
    [transactions, categoryMap, accountMap, accountCurrencyMap, paymentMap]
  );

  const cashflowTransactions = useMemo(
    () => displayTransactions.filter((transaction) => !transaction.is_transfer),
    [displayTransactions]
  );

  const tagOptions = useMemo(
    () => buildTagOptions(cashflowTransactions),
    [cashflowTransactions]
  );
  const tagSelectOptions = useMemo(
    () => tagOptions.map((tag) => ({ value: tag.name, label: tag.name })),
    [tagOptions]
  );

  const filteredTransactions = useMemo(
    () => filterDisplayTransactions(cashflowTransactions, filters),
    [cashflowTransactions, filters]
  );

  const metrics = useMemo(
    () =>
      calculateCashflowMetrics({
        transactions: filteredTransactions,
        month,
        categoryMap,
      }),
    [filteredTransactions, month, categoryMap]
  );

  const savingsRate =
    metrics.totalIncome > 0
      ? Math.round((metrics.net / metrics.totalIncome) * 100)
      : null;

  const expenseRows = useMemo(
    () => buildCategoryRows(metrics.topExpenseCategories, metrics.totalExpense),
    [metrics.topExpenseCategories, metrics.totalExpense]
  );

  const incomeRows = useMemo(
    () => buildCategoryRows(metrics.topIncomeCategories, metrics.totalIncome),
    [metrics.topIncomeCategories, metrics.totalIncome]
  );

  const recurringCount = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.is_recurring).length,
    [filteredTransactions]
  );
  const sharedCount = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.is_shared).length,
    [filteredTransactions]
  );
  const reimbursementCount = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.is_reimbursement).length,
    [filteredTransactions]
  );

  return {
    monthLabel,
    isTransactionsLoading,
    categoryMap,
    paymentMap,
    accountMap,
    paymentOptions,
    accountOptions,
    categoryOptions,
    tagSelectOptions,
    filteredTransactions,
    filteredCount: filteredTransactions.length,
    totalCount: cashflowTransactions.length,
    recurringCount,
    sharedCount,
    reimbursementCount,
    savingsRate,
    expenseRows,
    incomeRows,
    ...metrics,
  };
};
