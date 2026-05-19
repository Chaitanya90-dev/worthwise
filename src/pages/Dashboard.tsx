import {
  Accordion,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { OverviewCards } from "../components/dashboard/OverviewCards";
import { InsightsCard } from "../components/dashboard/InsightsCard";
import { AttentionStrip } from "../components/dashboard/AttentionStrip";
import { SoftCapAlerts } from "../components/dashboard/SoftCapAlerts";
import { RecentActivityTable } from "../components/dashboard/RecentActivityTable";
import { AccountBalances } from "../components/dashboard/AccountBalances";
import { CategoryInsightsCard } from "../components/dashboard/CategoryInsightsCard";
import { WhatChangedCard } from "../components/dashboard/WhatChangedCard";
import { QuickActionsCard } from "../components/dashboard/QuickActionsCard";
import { CoverageCard } from "../components/dashboard/CoverageCard";
import { NetCashflowCard } from "../components/dashboard/NetCashflowCard";
import { ForecastCard } from "../components/dashboard/ForecastCard";
import { UpcomingSubscriptionsCard } from "../components/dashboard/UpcomingSubscriptionsCard";
import {
  DashboardPinsModal,
  type DashboardPinOption,
} from "../components/dashboard/DashboardPinsModal";
import { useDashboardData } from "../hooks/useDashboardData";
import { useWeeklyCheckIn } from "../hooks/useWeeklyCheckIn";
import { useSetupChecklist } from "../hooks/useSetupChecklist";
import { useAttentionItems } from "../hooks/useAttentionItems";
import { useDashboardPins } from "../hooks/useDashboardPins";
import {
  useGetAccountsQuery,
  useGetReconciliationsQuery,
  useGetRecurringTransactionsQuery,
  useGetSubscriptionsQuery,
  useGetTransactionsByRangeQuery,
} from "../features/api/apiSlice";
import { getUpcomingSubscriptions, isSubscriptionOverdue } from "../lib/subscriptions";
import { getIncomeDelta, getNetExpenseDelta } from "../lib/transactions";
import { buildCashRunwayForecast } from "../lib/forecast";
import { buildCategoryInsights } from "../lib/categoryInsights";
import { buildCategoryLookup, rollupCategoryTotals } from "../lib/categories";
import { formatMonthLabel } from "../lib/format";
import { buildWhatChangedInsights } from "../lib/whatChanged";
import { useAppMonth } from "../context/AppMonthContext";

const PIN_OPTIONS: DashboardPinOption[] = [
  {
    id: "quick-actions",
    label: "Quick actions",
    description: "Shortcuts to add transactions, subscriptions, and budgets.",
  },
  {
    id: "setup-checklist",
    label: "Setup checklist",
    description: "Finish the basics to unlock smarter insights. Shows until complete.",
  },
  {
    id: "weekly-checkin",
    label: "Weekly check-in",
    description: "Top insights and one action to try this week.",
  },
  {
    id: "attention",
    label: "Attention strip",
    description: "Overdue bills, budget warnings, and missing data.",
  },
  {
    id: "accounts",
    label: "Account balances",
    description: "Balances across bank, credit card, cash, and wallet.",
  },
  {
    id: "soft-cap",
    label: "Budget alerts",
    description: "Categories nearing or over budget.",
  },
  {
    id: "category-insights",
    label: "Category insights",
    description: "Month-over-month movers and outlier spend.",
  },
  {
    id: "what-changed",
    label: "What changed",
    description: "New counterparties and unusual spend highlights.",
  },
  {
    id: "coverage",
    label: "Coverage",
    description: "Cash vs allocated funds coverage.",
  },
  {
    id: "net-cashflow",
    label: "Net cashflow",
    description: "This month's inflow vs outflow.",
  },
  {
    id: "forecast",
    label: "Forecast",
    description: "Runway and recurring impact.",
  },
  {
    id: "upcoming-subscriptions",
    label: "Upcoming renewals",
    description: "Bills due in the next 30 days.",
  },
];

const PIN_IDS = PIN_OPTIONS.map((option) => option.id);

export const Dashboard = () => {
  const { month } = useAppMonth();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [rollupCategories, setRollupCategories] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    try {
      const saved = window.localStorage.getItem(
        "cashcove:dashboard:rollupCategories"
      );
      if (saved === null) {
        return true;
      }
      return saved === "true";
    } catch {
      return true;
    }
  });
  const [pinsModalOpen, setPinsModalOpen] = useState(false);
  const [hideBalances, setHideBalances] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    try {
      const saved = window.localStorage.getItem(
        "cashcove:dashboard:hideBalances"
      );
      if (saved === null) {
        return true;
      }
      return saved === "true";
    } catch {
      return true;
    }
  });
  const { pinned, isPinned, togglePin, resetPins } = useDashboardPins({
    availableIds: PIN_IDS,
    defaultPins: PIN_IDS,
  });
  const { data: accounts = [], isLoading: isAccountsLoading } =
    useGetAccountsQuery();
  const { data: subscriptions = [] } = useGetSubscriptionsQuery();
  const { data: reconciliations = [] } = useGetReconciliationsQuery({});
  const { data: recurringTransactions = [] } = useGetRecurringTransactionsQuery();
  const recentRangeStart = dayjs().subtract(29, "day").format("YYYY-MM-DD");
  const recentRangeEnd = dayjs().format("YYYY-MM-DD");
  const { data: recentTransactions = [] } = useGetTransactionsByRangeQuery({
    start: recentRangeStart,
    end: recentRangeEnd,
  });
  const {
    monthLabel,
    categories,
    transactions,
    isLoading,
    hasBudgets,
    categoryMap,
    pieData,
    dailyData,
    warnings,
    remaining,
    totalSpent,
    totalBudget,
    funds,
    categoryTotals,
    categoryBudgets,
  } = useDashboardData({ selectedMonth: month, rollupCategories });
  const previousMonth = dayjs(month + "-01").subtract(1, "month").format("YYYY-MM");
  const {
    transactions: previousTransactions,
    totalSpent: previousTotalSpent,
    totalBudget: previousTotalBudget,
    budgets: previousBudgets,
    categoryTotals: previousCategoryTotalsRaw,
  } = useDashboardData({ selectedMonth: previousMonth });
  const previousMonthLabel = useMemo(
    () => formatMonthLabel(previousMonth),
    [previousMonth]
  );
  const categoryLookup = useMemo(
    () => buildCategoryLookup(categories),
    [categories]
  );
  const currentCategoryTotals = useMemo(
    () =>
      rollupCategories
        ? rollupCategoryTotals(categoryTotals, categoryLookup)
        : categoryTotals,
    [categoryLookup, categoryTotals, rollupCategories]
  );
  const previousCategoryTotals = useMemo(
    () =>
      rollupCategories
        ? rollupCategoryTotals(previousCategoryTotalsRaw, categoryLookup)
        : previousCategoryTotalsRaw,
    [categoryLookup, previousCategoryTotalsRaw, rollupCategories]
  );
  const categoryInsights = useMemo(
    () =>
      buildCategoryInsights({
        currentTotals: currentCategoryTotals,
        previousTotals: previousCategoryTotals,
        categoryMap,
      }),
    [categoryMap, currentCategoryTotals, previousCategoryTotals]
  );
  const whatChanged = useMemo(
    () =>
      buildWhatChangedInsights({
        current: transactions,
        previous: previousTransactions,
      }),
    [previousTransactions, transactions]
  );
  const hasPreviousMonthData =
    previousTransactions.length > 0 ||
    previousTotalSpent > 0 ||
    previousTotalBudget > 0 ||
    previousBudgets.length > 0;
  const cashOnHand = accounts.reduce(
    (sum, account) => sum + (account.current_balance ?? 0),
    0
  );
  const { incomeTotal, expenseTotal } = useMemo(() => {
    const income = transactions.reduce((sum, tx) => sum + getIncomeDelta(tx), 0);
    const expense = transactions.reduce(
      (sum, tx) => sum + getNetExpenseDelta(tx),
      0
    );
    return { incomeTotal: income, expenseTotal: expense };
  }, [transactions]);
  const avgDailySpend = useMemo(() => {
    const days = dayjs(recentRangeEnd).diff(dayjs(recentRangeStart), "day") + 1;
    const total = recentTransactions.reduce(
      (sum, tx) => sum + getNetExpenseDelta(tx),
      0
    );
    return Math.max(0, total) / Math.max(1, days);
  }, [recentRangeEnd, recentRangeStart, recentTransactions]);
  const { recurringIncome, recurringExpense } = useMemo(() => {
    const income = recurringTransactions.reduce(
      (sum, tx) => sum + getIncomeDelta(tx),
      0
    );
    const expense = recurringTransactions.reduce(
      (sum, tx) => sum + getNetExpenseDelta(tx),
      0
    );
    return { recurringIncome: income, recurringExpense: expense };
  }, [recurringTransactions]);
  const dueSoonCount = useMemo(
    () =>
      getUpcomingSubscriptions(subscriptions, 7).filter(
        (sub) => sub.status === "active" && !isSubscriptionOverdue(sub)
      ).length,
    [subscriptions]
  );
  const overdueCount = useMemo(
    () =>
      subscriptions.filter(
        (sub) =>
          sub.status === "active" &&
          sub.next_due &&
          isSubscriptionOverdue(sub)
      ).length,
    [subscriptions]
  );

  const reconciliationMismatchCount = useMemo(() => {
    if (reconciliations.length === 0 || accounts.length === 0) {
      return 0;
    }
    const latestByAccount = new Map<string, { statement_balance: number; statement_date: string }>();
    reconciliations.forEach((item) => {
      const existing = latestByAccount.get(item.account_id);
      if (!existing || dayjs(item.statement_date).isAfter(existing.statement_date, "day")) {
        latestByAccount.set(item.account_id, {
          statement_balance: item.statement_balance,
          statement_date: item.statement_date,
        });
      }
    });
    return accounts.filter((account) => {
      const latest = latestByAccount.get(account.id);
      if (!latest) {
        return false;
      }
      const delta = Number(latest.statement_balance) - Number(account.current_balance ?? 0);
      return Math.abs(delta) >= 0.01;
    }).length;
  }, [accounts, reconciliations]);

  const forecast = useMemo(
    () =>
      buildCashRunwayForecast({
        startBalance: cashOnHand,
        avgDailySpend,
        recurringTransactions,
        subscriptions,
        days: 60,
      }),
    [cashOnHand, avgDailySpend, recurringTransactions, subscriptions]
  );
  const forecast30Balance = forecast.daily[29]?.balance ?? cashOnHand;
  const forecast60Balance = forecast.endBalance;
  const { insights: weeklyInsights, nudge: weeklyNudge } = useWeeklyCheckIn({
    transactionsCount: transactions.length,
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
    dueSoonSubscriptionsCount: dueSoonCount,
  });
  const { items: setupItems, showSetupChecklist } = useSetupChecklist({
    accountsCount: accounts.length,
    categoriesCount: categories.length,
    hasBudgets,
    subscriptionsCount: subscriptions.length,
  });
  const attentionItems = useAttentionItems({
    hasBudgets,
    warnings,
    overdueCount,
    dueSoonCount,
    subscriptionsCount: subscriptions.length,
    isLoading,
    transactionsCount: transactions.length,
    accountsCount: accounts.length,
    reconciliationMismatchCount,
    forecast: {
      minBalance: forecast.minBalance,
      minDate: forecast.minDate,
      firstNegativeDate: forecast.firstNegativeDate,
      avgDailySpend,
    },
  });
  const showSetupChecklistCard =
    showSetupChecklist && isPinned("setup-checklist");
  const showQuickActionsCard = isPinned("quick-actions");
  const showWeeklyCheckInCard = isPinned("weekly-checkin");
  const showAttentionStrip = isPinned("attention");
  const showAccountBalances = isPinned("accounts");
  const showSoftCapAlerts = isPinned("soft-cap");
  const showCategoryInsightsCard = isPinned("category-insights");
  const showWhatChangedCard = isPinned("what-changed");
  const showCoverageCard = isPinned("coverage");
  const showNetCashflowCard = isPinned("net-cashflow");
  const showForecastCard = isPinned("forecast");
  const showUpcomingSubscriptionsCard = isPinned("upcoming-subscriptions");
  const showInsightsCard = showSetupChecklistCard || showWeeklyCheckInCard;
  const showBalanceGroup = showAccountBalances || showSoftCapAlerts;
  const showPlanningGroup =
    showWhatChangedCard ||
    showCoverageCard ||
    showNetCashflowCard ||
    showForecastCard ||
    showUpcomingSubscriptionsCard ||
    showCategoryInsightsCard;
  const visiblePinnedCount = [
    showQuickActionsCard,
    showSetupChecklistCard,
    showWeeklyCheckInCard,
    showAttentionStrip,
    showAccountBalances,
    showSoftCapAlerts,
    showCategoryInsightsCard,
    showWhatChangedCard,
    showCoverageCard,
    showNetCashflowCard,
    showForecastCard,
    showUpcomingSubscriptionsCard,
  ].filter(Boolean).length;
  const hasPinnedSelections = pinned.length > 0;
  const sectionStyle = (delayMs: number): CSSProperties => ({
    "--dash-delay": `${delayMs}ms`,
  } as CSSProperties);
  const pinnedHeader = (
    <Group
      justify="space-between"
      align="center"
      wrap="wrap"
      gap="xs"
      className="dashboard-section"
      style={sectionStyle(20)}
    >
      <Stack gap={2}>
        <Text fw={600}>Pinned cards</Text>
        <Text size="sm" c="dimmed">
          Pick the cards you want to see first.
        </Text>
      </Stack>
      <Group gap="xs" align="center" wrap="wrap">
        <Text size="xs" c="dimmed">
          {pinned.length} of {PIN_OPTIONS.length} pinned
        </Text>
        <Button
          variant="light"
          size="xs"
          leftSection={<SlidersHorizontal size={14} />}
          onClick={() => setPinsModalOpen(true)}
        >
          Customize
        </Button>
      </Group>
    </Group>
  );
  const pinnedHeaderMobile = (
    <Group justify="space-between" align="center" wrap="wrap" gap="xs">
      <Stack gap={2}>
        <Text fw={600}>Pinned cards</Text>
        <Text size="xs" c="dimmed">
          {pinned.length} of {PIN_OPTIONS.length} pinned
        </Text>
      </Stack>
      <Button
        variant="light"
        size="xs"
        leftSection={<SlidersHorizontal size={14} />}
        onClick={() => setPinsModalOpen(true)}
      >
        Customize
      </Button>
    </Group>
  );
  const pinnedCardsContent =
    visiblePinnedCount === 0 ? (
      <Paper
        withBorder
        shadow="sm"
        radius="lg"
        p="md"
        className="dashboard-section"
        style={sectionStyle(60)}
      >
        <Stack gap="xs">
          <Text fw={600}>
            {hasPinnedSelections ? "No pinned cards to show" : "No pinned cards yet"}
          </Text>
          <Text size="sm" c="dimmed">
            {hasPinnedSelections
              ? "Adjust your pins to bring a card back to the top of the dashboard."
              : "Choose the cards you want to see at the top of your dashboard."}
          </Text>
          <Button variant="light" size="xs" onClick={() => setPinsModalOpen(true)}>
            {hasPinnedSelections ? "Adjust pins" : "Choose cards"}
          </Button>
        </Stack>
      </Paper>
    ) : (
      <>
        {showQuickActionsCard ? (
          <QuickActionsCard style={sectionStyle(30)} />
        ) : null}
        {showInsightsCard ? (
          <InsightsCard
            showSetup={showSetupChecklistCard}
            showWeekly={showWeeklyCheckInCard}
            setupItems={setupItems}
            weeklyInsights={weeklyInsights}
            weeklyNudge={weeklyNudge}
            style={sectionStyle(40)}
          />
        ) : null}

        {showAttentionStrip ? (
          <AttentionStrip items={attentionItems} style={sectionStyle(160)} />
        ) : null}

        {showBalanceGroup ? (
          <Group align="stretch" grow wrap="wrap" gap="md">
            {showAccountBalances ? (
              <AccountBalances
                accounts={accounts}
                hidden={hideBalances}
                onToggle={() => setHideBalances((prev) => !prev)}
                loading={isAccountsLoading}
                icon={hideBalances ? <Eye size={16} /> : <EyeOff size={16} />}
                style={{ flex: "1 1 320px" }}
              />
            ) : null}
            {showSoftCapAlerts ? (
              <SoftCapAlerts
                warnings={warnings}
                hasBudgets={hasBudgets}
                style={{ flex: "1 1 320px" }}
              />
            ) : null}
          </Group>
        ) : null}

        {showPlanningGroup ? (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
            {showWhatChangedCard ? (
              <WhatChangedCard
                insights={whatChanged}
                outliers={categoryInsights.outliers}
                comparisonLabel={previousMonthLabel}
                style={{ height: "100%" }}
              />
            ) : null}
            {showCategoryInsightsCard ? (
              <CategoryInsightsCard
                insights={categoryInsights}
                comparisonLabel={previousMonthLabel}
                style={{ height: "100%" }}
              />
            ) : null}
            {showCoverageCard ? (
              <CoverageCard
                cashOnHand={cashOnHand}
                funds={funds}
                style={{ height: "100%" }}
              />
            ) : null}
            {showNetCashflowCard ? (
              <NetCashflowCard
                income={incomeTotal}
                expense={expenseTotal}
                style={{ height: "100%" }}
              />
            ) : null}
            {showForecastCard ? (
              <ForecastCard
                cashOnHand={cashOnHand}
                avgDailySpend={avgDailySpend}
                recurringIncome={recurringIncome}
                recurringExpense={recurringExpense}
                forecast30={forecast30Balance}
                forecast60={forecast60Balance}
                minBalance={forecast.minBalance}
                minBalanceDate={forecast.minDate}
                firstNegativeDate={forecast.firstNegativeDate}
                style={{ height: "100%" }}
              />
            ) : null}
            {showUpcomingSubscriptionsCard ? (
              <UpcomingSubscriptionsCard
                subscriptions={subscriptions}
                style={{ height: "100%" }}
              />
            ) : null}
          </SimpleGrid>
        ) : null}
      </>
    );
  const chartsBlock = (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text size="sm" c="dimmed" maw={{ base: "100%", sm: "70%" }}>
          Charts show subcategories rolled into their parent when enabled.
        </Text>
        <Switch
          label="Roll up subcategories in charts"
          checked={rollupCategories}
          onChange={(event) => setRollupCategories(event.currentTarget.checked)}
        />
      </Group>
      <ChartsSection pieData={pieData} dailyData={dailyData} />
    </Stack>
  );
  const pinnedCardsContentMobile =
    visiblePinnedCount === 0 ? (
      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Stack gap="xs">
          <Text fw={600}>
            {hasPinnedSelections ? "No pinned cards to show" : "No pinned cards yet"}
          </Text>
          <Text size="sm" c="dimmed">
            {hasPinnedSelections
              ? "Adjust your pins to bring a card back to the top of the dashboard."
              : "Choose the cards you want to see at the top of your dashboard."}
          </Text>
          <Button variant="light" size="xs" onClick={() => setPinsModalOpen(true)}>
            {hasPinnedSelections ? "Adjust pins" : "Choose cards"}
          </Button>
        </Stack>
      </Paper>
    ) : (
      <Stack gap="md">
        {showQuickActionsCard ? (
          <QuickActionsCard />
        ) : null}
        {showInsightsCard ? (
          <InsightsCard
            showSetup={showSetupChecklistCard}
            showWeekly={showWeeklyCheckInCard}
            setupItems={setupItems}
            weeklyInsights={weeklyInsights}
            weeklyNudge={weeklyNudge}
          />
        ) : null}
        {showAttentionStrip ? <AttentionStrip items={attentionItems} /> : null}
        {showAccountBalances ? (
          <AccountBalances
            accounts={accounts}
            hidden={hideBalances}
            onToggle={() => setHideBalances((prev) => !prev)}
            loading={isAccountsLoading}
            icon={hideBalances ? <Eye size={16} /> : <EyeOff size={16} />}
          />
        ) : null}
        {showSoftCapAlerts ? (
          <SoftCapAlerts warnings={warnings} hasBudgets={hasBudgets} />
        ) : null}
        {showWhatChangedCard ? (
          <WhatChangedCard
            insights={whatChanged}
            outliers={categoryInsights.outliers}
            comparisonLabel={previousMonthLabel}
          />
        ) : null}
        {showCategoryInsightsCard ? (
          <CategoryInsightsCard
            insights={categoryInsights}
            comparisonLabel={previousMonthLabel}
          />
        ) : null}
        {showCoverageCard ? <CoverageCard cashOnHand={cashOnHand} funds={funds} /> : null}
        {showNetCashflowCard ? (
          <NetCashflowCard income={incomeTotal} expense={expenseTotal} />
        ) : null}
        {showForecastCard ? (
          <ForecastCard
            cashOnHand={cashOnHand}
            avgDailySpend={avgDailySpend}
            recurringIncome={recurringIncome}
            recurringExpense={recurringExpense}
            forecast30={forecast30Balance}
            forecast60={forecast60Balance}
            minBalance={forecast.minBalance}
            minBalanceDate={forecast.minDate}
            firstNegativeDate={forecast.firstNegativeDate}
          />
        ) : null}
        {showUpcomingSubscriptionsCard ? (
          <UpcomingSubscriptionsCard subscriptions={subscriptions} />
        ) : null}
      </Stack>
    );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:dashboard:rollupCategories",
        String(rollupCategories)
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [rollupCategories]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:dashboard:hideBalances",
        String(hideBalances)
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [hideBalances]);
  return (
    <Stack gap="lg">
      <OverviewCards
        monthLabel={monthLabel}
        transactionCount={transactions.length}
        totalSpent={totalSpent}
        totalBudget={totalBudget}
        remaining={remaining}
        previousTransactionCount={previousTransactions.length}
        previousTotalSpent={previousTotalSpent}
        previousTotalBudget={previousTotalBudget}
        hasPreviousMonthData={hasPreviousMonthData}
      />
      {isMobile ? (
        <Accordion multiple defaultValue={["pinned"]} variant="separated">
          <Accordion.Item value="pinned">
            <Accordion.Control>
              <Group justify="space-between" align="center" style={{ width: "100%" }}>
                <Text fw={600}>Pinned cards</Text>
                <Text size="xs" c="dimmed">
                  {pinned.length}/{PIN_OPTIONS.length}
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {pinnedHeaderMobile}
                {pinnedCardsContentMobile}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="charts">
            <Accordion.Control>
              <Text fw={600}>Charts & trends</Text>
            </Accordion.Control>
            <Accordion.Panel>{chartsBlock}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="activity">
            <Accordion.Control>
              <Text fw={600}>Recent activity</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <RecentActivityTable
                transactions={transactions}
                categoryMap={categoryMap}
                isLoading={isLoading}
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : (
        <>
          {pinnedHeader}
          {pinnedCardsContent}
          {chartsBlock}
          <RecentActivityTable
            transactions={transactions}
            categoryMap={categoryMap}
            isLoading={isLoading}
          />
        </>
      )}
      <DashboardPinsModal
        opened={pinsModalOpen}
        onClose={() => setPinsModalOpen(false)}
        options={PIN_OPTIONS}
        pinnedIds={pinned}
        onToggle={togglePin}
        onReset={resetPins}
      />
    </Stack>
  );
};
