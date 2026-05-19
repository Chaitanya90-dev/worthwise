import { Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import { useState } from "react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { CategoryTrendChart } from "../components/reports/CategoryTrendChart";
import { ReportHeader } from "../components/reports/ReportHeader";
import { ReportSummaryCards } from "../components/reports/ReportSummaryCards";
import { ReportsViewToggle } from "../components/reports/ReportsViewToggle";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTransactionsByRangeQuery,
} from "../features/api/apiSlice";
import { buildDailyData, buildPieData } from "../lib/dashboard";
import {
  buildCategoryTrendData,
  buildChange,
  buildReportCsvRows,
  buildReportHtml,
  downloadCsv,
  getDefaultReportRange,
  inDateRange,
  normalizeReportRange,
  openPrintWindow,
  sumByType,
} from "../lib/reports";
import { getNetExpenseCategoryKey, getNetExpenseDelta } from "../lib/transactions";

const INITIAL_RANGE = getDefaultReportRange();

export const Reports = () => {
  const [start, setStart] = useState<Date | null>(INITIAL_RANGE.start);
  const [end, setEnd] = useState<Date | null>(INITIAL_RANGE.end);
  const [trendMode, setTrendMode] = useState<"top" | "all">("top");
  const { startDate, endDate, spanDays } = normalizeReportRange(start, end);
  const prevStart = startDate
    ? dayjs(startDate).subtract(spanDays || 0, "day").format("YYYY-MM-DD")
    : "";
  const prevEnd = startDate
    ? dayjs(startDate).subtract(1, "day").format("YYYY-MM-DD")
    : "";

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: transactions = [], isLoading } = useGetTransactionsByRangeQuery(
    { start: prevStart || startDate, end: endDate },
    { skip: !startDate || !endDate }
  );

  const currentTransactions =
    startDate && endDate
      ? transactions.filter((tx) => inDateRange(tx, startDate, endDate))
      : [];
  const previousTransactions =
    prevStart && prevEnd
      ? transactions.filter((tx) => inDateRange(tx, prevStart, prevEnd))
      : [];

  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name])
  );
  const accountMap = new Map(
    accounts.map((account) => [account.id, account.name])
  );
  const paymentMap = new Map(
    paymentMethods.map((method) => [method.id, method.name])
  );

  const incomeTotal = sumByType(currentTransactions, "income");
  const expenseTotal = sumByType(currentTransactions, "expense");
  const netTotal = incomeTotal - expenseTotal;
  const prevIncome = sumByType(previousTransactions, "income");
  const prevExpense = sumByType(previousTransactions, "expense");
  const incomeChange = buildChange(incomeTotal, prevIncome);
  const expenseChange = buildChange(expenseTotal, prevExpense);

  const categoryTotals = new Map<string, number>();
  currentTransactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    const key = getNetExpenseCategoryKey(tx);
    if (!key) {
      return;
    }
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + delta);
  });
  const pieData = buildPieData(categoryTotals, categoryMap).sort(
    (a, b) => b.value - a.value
  );

  const dailyTotals = new Map<string, number>();
  currentTransactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    dailyTotals.set(tx.date, (dailyTotals.get(tx.date) ?? 0) + delta);
  });
  const dailyData = buildDailyData(dailyTotals);

  const { data: trendData, series: trendSeries } = buildCategoryTrendData(
    currentTransactions,
    categoryMap,
    startDate,
    endDate,
    trendMode
  );

  const rangeLabel = startDate && endDate
    ? `${dayjs(startDate).format("DD MMM")} – ${dayjs(endDate).format("DD MMM")}`
    : "Select a range";
  const prevRangeLabel =
    prevStart && prevEnd
      ? `${dayjs(prevStart).format("DD MMM")} – ${dayjs(prevEnd).format("DD MMM")}`
      : "-";

  const handleExportCsv = () => {
    if (!startDate || !endDate) {
      return;
    }
    const rows = buildReportCsvRows(
      currentTransactions,
      categoryMap,
      accountMap,
      paymentMap
    );
    const safeRange = `${startDate}-to-${endDate}`;
    downloadCsv(`cashcove-report-${safeRange}.csv`, rows);
  };

  const handleExportPdf = () => {
    if (!startDate || !endDate) {
      return;
    }
    const html = buildReportHtml({
      rangeLabel,
      incomeTotal,
      expenseTotal,
      netTotal,
      categoryItems: pieData.slice(0, 6),
      transactions: currentTransactions,
      categoryMap,
    });
    openPrintWindow("CashCove report", html);
  };

  return (
    <Stack gap="lg">
      <ReportHeader
        rangeLabel={rangeLabel}
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        disableExport={!startDate || !endDate}
        transactionCount={currentTransactions.length}
        spanDays={spanDays}
        viewToggle={<ReportsViewToggle value="reports" />}
      />

      <ReportSummaryCards
        incomeTotal={incomeTotal}
        expenseTotal={expenseTotal}
        netTotal={netTotal}
        prevRangeLabel={prevRangeLabel}
        incomeChange={incomeChange}
        expenseChange={expenseChange}
      />

      <ChartsSection pieData={pieData} dailyData={dailyData} />

      <CategoryTrendChart
        data={trendData}
        series={trendSeries}
        mode={trendMode}
        onModeChange={setTrendMode}
      />

      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading report data...
        </Text>
      ) : null}
    </Stack>
  );
};
