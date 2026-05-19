import {
  Badge,
  Button,
  Collapse,
  Group,
  Modal,
  Paper,
  Popover,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Repeat,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetRecurringTransactionsQuery,
  useGetSubscriptionsQuery,
} from "../features/api/apiSlice";
import { EmptyState } from "../components/common/EmptyState";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { PageStatusChips } from "../components/common/PageStatusChips";
import { useAppSelector } from "../app/hooks";
import { useAppMonth } from "../context/AppMonthContext";
import { appPath } from "../app/paths";
import { formatINR, formatMonthLabel } from "../lib/format";
import { scoreSearchMatch } from "../lib/globalSearch";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import {
  formatIntervalLabel,
  getSubscriptionNativeAmountLabel,
  getSubscriptionPlanningAmount,
  isForeignCurrencySubscription,
} from "../lib/subscriptions";
import { getTransactionCounterpartyName } from "../lib/transactions";
import type { Transaction } from "../types/finance";

type BillTiming = "overdue" | "today" | "soon" | "later";

type BillItem = {
  id: string;
  source: "subscription" | "recurring";
  title: string;
  dueDate: string;
  amount: number;
  amountDetail: string | null;
  type: "expense" | "income";
  categoryId: string | null;
  category: string;
  accountId: string | null;
  account: string;
  paymentId: string | null;
  payment: string;
  cadence: string;
  timing: BillTiming;
};

type BillsFilterState = {
  search: string;
  source: "all" | "subscription" | "recurring";
  type: "all" | "expense" | "income";
  accountId: string;
  categoryId: string;
  paymentId: string;
  timing: "all" | BillTiming;
};

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:bills:${userId ?? "anon"}`;

const createEmptyBillsFilters = (): BillsFilterState => ({
  search: "",
  source: "all",
  type: "all",
  accountId: "",
  categoryId: "",
  paymentId: "",
  timing: "all",
});

const normalizeBillsFilters = (
  value: Partial<BillsFilterState> = {}
): BillsFilterState => ({
  search: value.search?.trim() ?? "",
  source:
    value.source === "subscription" || value.source === "recurring"
      ? value.source
      : "all",
  type:
    value.type === "expense" || value.type === "income" ? value.type : "all",
  accountId: value.accountId?.trim() ?? "",
  categoryId: value.categoryId?.trim() ?? "",
  paymentId: value.paymentId?.trim() ?? "",
  timing:
    value.timing === "overdue" ||
    value.timing === "today" ||
    value.timing === "soon" ||
    value.timing === "later"
      ? value.timing
      : "all",
});

const areBillsFiltersEqual = (
  left: Partial<BillsFilterState>,
  right: Partial<BillsFilterState>
) =>
  JSON.stringify(normalizeBillsFilters(left)) ===
  JSON.stringify(normalizeBillsFilters(right));

const buildDueDateForMonth = (
  anchorDate: string,
  month: string,
  intervalMonths = 1
) => {
  const anchor = dayjs(anchorDate);
  if (!anchor.isValid()) {
    return null;
  }
  const monthStart = dayjs(`${month}-01`).startOf("month");
  const anchorMonth = anchor.startOf("month");
  if (monthStart.isBefore(anchorMonth)) {
    return null;
  }
  const interval = Math.max(1, intervalMonths);
  const monthDiff = monthStart.diff(anchorMonth, "month");
  if (monthDiff % interval !== 0) {
    return null;
  }
  const dueDay = Math.min(anchor.date(), monthStart.daysInMonth());
  return monthStart.date(dueDay).format("YYYY-MM-DD");
};

const getBillTiming = (dueDate: string): BillTiming => {
  const today = dayjs().startOf("day");
  const due = dayjs(dueDate).startOf("day");
  const diff = due.diff(today, "day");
  if (diff < 0) {
    return "overdue";
  }
  if (diff === 0) {
    return "today";
  }
  if (diff <= 7) {
    return "soon";
  }
  return "later";
};

const buildRecurringLabel = (transaction: Transaction, categoryLabel: string) => {
  const counterpartyLabel = getTransactionCounterpartyName(transaction);
  if (counterpartyLabel) {
    return counterpartyLabel;
  }
  if (transaction.notes?.trim()) {
    return transaction.notes.trim();
  }
  if (categoryLabel && categoryLabel !== "Uncategorized") {
    return categoryLabel;
  }
  return transaction.type === "income" ? "Recurring income" : "Recurring bill";
};

const normalizeRecurringKeyPart = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const buildRecurringSeriesKey = (
  transaction: Transaction,
  categoryLabel: string
) => {
  const anchor = dayjs(transaction.date);
  const dueDay = anchor.isValid() ? anchor.date() : 0;
  const label = buildRecurringLabel(transaction, categoryLabel);
  return [
    transaction.type,
    transaction.amount.toFixed(2),
    transaction.category_id ?? "",
    transaction.account_id ?? "",
    transaction.payment_method_id ?? "",
    normalizeRecurringKeyPart(label),
    String(dueDay),
  ].join("|");
};

export const Bills = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { month, setMonth } = useAppMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "subscription" | "recurring"
  >("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">(
    "all"
  );
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [timingFilter, setTimingFilter] = useState<"all" | BillTiming>("all");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<BillsFilterState>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));

  useEffect(() => {
    setSavedFilters(loadSavedFilters(buildFiltersKey(userId)));
  }, [userId]);

  const { data: subscriptions = [] } = useGetSubscriptionsQuery();
  const { data: recurringTransactions = [] } = useGetRecurringTransactionsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();

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

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.status === "active"),
    [subscriptions]
  );

  const billItems = useMemo(() => {
    const items: BillItem[] = [];

    activeSubscriptions.forEach((sub) => {
      // next_due reflects the current unpaid cycle; billing_anchor is just the original start.
      // Anchor on next_due first so paid subscriptions do not keep showing overdue.
      const anchor = sub.next_due || sub.billing_anchor;
      if (!anchor) {
        return;
      }
      const dueDate = buildDueDateForMonth(anchor, month, sub.interval_months);
      if (!dueDate) {
        return;
      }
      const categoryLabel = sub.category_id
        ? categoryMap.get(sub.category_id) ?? "Uncategorized"
        : "Uncategorized";
      items.push({
        id: `sub-${sub.id}`,
        source: "subscription",
        title: sub.name,
        dueDate,
        amount: getSubscriptionPlanningAmount(sub),
        amountDetail: isForeignCurrencySubscription(sub)
          ? getSubscriptionNativeAmountLabel(sub)
          : null,
        type: "expense",
        categoryId: sub.category_id ?? null,
        category: categoryLabel,
        accountId: sub.account_id ?? null,
        account: sub.account_id
          ? accountMap.get(sub.account_id) ?? "-"
          : "-",
        paymentId: sub.payment_method_id ?? null,
        payment: sub.payment_method_id
          ? paymentMap.get(sub.payment_method_id) ?? "-"
          : "-",
        cadence: formatIntervalLabel(sub.interval_months),
        timing: getBillTiming(dueDate),
      });
    });

    const recurringSeries = new Map<
      string,
      { transaction: Transaction; categoryLabel: string }
    >();

    recurringTransactions.forEach((tx) => {
      if (!tx.is_recurring) {
        return;
      }
      if (tx.is_transfer || tx.is_reimbursement) {
        return;
      }
      const categoryLabel = tx.category_id
        ? categoryMap.get(tx.category_id) ?? "Uncategorized"
        : "Uncategorized";
      const seriesKey = buildRecurringSeriesKey(tx, categoryLabel);
      const existing = recurringSeries.get(seriesKey);
      if (!existing) {
        recurringSeries.set(seriesKey, { transaction: tx, categoryLabel });
        return;
      }
      const nextDate = dayjs(tx.date);
      const existingDate = dayjs(existing.transaction.date);
      if (!nextDate.isValid()) {
        return;
      }
      if (!existingDate.isValid() || nextDate.isAfter(existingDate, "day")) {
        recurringSeries.set(seriesKey, { transaction: tx, categoryLabel });
      }
    });

    recurringSeries.forEach(({ transaction: tx, categoryLabel }) => {
      const dueDate = buildDueDateForMonth(tx.date, month, 1);
      if (!dueDate) {
        return;
      }
      items.push({
        id: `rec-${tx.id}`,
        source: "recurring",
        title: buildRecurringLabel(tx, categoryLabel),
        dueDate,
        amount: tx.amount,
        amountDetail: null,
        type: tx.type,
        categoryId: tx.category_id ?? null,
        category: categoryLabel,
        accountId: tx.account_id ?? null,
        account: tx.account_id ? accountMap.get(tx.account_id) ?? "-" : "-",
        paymentId: tx.payment_method_id ?? null,
        payment: tx.payment_method_id
          ? paymentMap.get(tx.payment_method_id) ?? "-"
          : "-",
        cadence: "Monthly",
        timing: getBillTiming(dueDate),
      });
    });

    return items.sort((a, b) => dayjs(a.dueDate).diff(dayjs(b.dueDate)));
  }, [
    activeSubscriptions,
    recurringTransactions,
    month,
    categoryMap,
    accountMap,
    paymentMap,
  ]);

  const monthStart = useMemo(() => dayjs(`${month}-01`), [month]);
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);
  const isCurrentMonth = monthStart.isSame(dayjs(), "month");
  const currentFilters = useMemo(
    () =>
      normalizeBillsFilters({
        search,
        source: sourceFilter,
        type: typeFilter,
        accountId: filterAccount,
        categoryId: filterCategory,
        paymentId: filterPayment,
        timing: timingFilter,
      }),
    [
      search,
      sourceFilter,
      typeFilter,
      filterAccount,
      filterCategory,
      filterPayment,
      timingFilter,
    ]
  );
  const hasActiveFilters = useMemo(
    () =>
      !areBillsFiltersEqual(currentFilters, createEmptyBillsFilters()) ||
      Boolean(selectedDate),
    [currentFilters, selectedDate]
  );

  const filteredItems = useMemo(
    () => {
      const searchQuery = search.trim();
      return billItems.filter((item) => {
        if (sourceFilter !== "all" && item.source !== sourceFilter) {
          return false;
        }
        if (typeFilter !== "all" && item.type !== typeFilter) {
          return false;
        }
        if (filterAccount === "none" && item.accountId) {
          return false;
        }
        if (
          filterAccount &&
          filterAccount !== "none" &&
          item.accountId !== filterAccount
        ) {
          return false;
        }
        if (filterCategory === "uncategorized" && item.categoryId) {
          return false;
        }
        if (
          filterCategory &&
          filterCategory !== "uncategorized" &&
          item.categoryId !== filterCategory
        ) {
          return false;
        }
        if (filterPayment === "none" && item.paymentId) {
          return false;
        }
        if (
          filterPayment &&
          filterPayment !== "none" &&
          item.paymentId !== filterPayment
        ) {
          return false;
        }
        if (timingFilter !== "all" && item.timing !== timingFilter) {
          return false;
        }
        if (!searchQuery) {
          return true;
        }
        return (
          scoreSearchMatch({
            query: searchQuery,
            primaryText: item.title,
            aliasTexts: [
              item.category,
              item.account,
              item.payment,
              item.cadence,
              item.source,
              item.type,
              dayjs(item.dueDate).format("DD MMM YYYY"),
            ],
            valueTexts: [
              item.amount.toString(),
              formatINR(item.amount),
              item.amountDetail ?? "",
            ],
          }) !== null
        );
      });
    },
    [
      billItems,
      search,
      sourceFilter,
      typeFilter,
      filterAccount,
      filterCategory,
      filterPayment,
      timingFilter,
    ]
  );

  const dueDates = useMemo(
    () => new Set(filteredItems.map((item) => item.dueDate)),
    [filteredItems]
  );

  const selectedKey = useMemo(() => {
    if (!selectedDate) {
      return null;
    }
    const date = dayjs(selectedDate);
    if (!date.isSame(monthStart, "month")) {
      return null;
    }
    return date.format("YYYY-MM-DD");
  }, [selectedDate, monthStart]);

  const visibleItems = selectedKey
    ? filteredItems.filter((item) => item.dueDate === selectedKey)
    : filteredItems;

  const groupedItems = useMemo(() => {
    const map = new Map<string, BillItem[]>();
    visibleItems.forEach((item) => {
      const list = map.get(item.dueDate) ?? [];
      list.push(item);
      map.set(item.dueDate, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      dayjs(a).diff(dayjs(b))
    );
  }, [visibleItems]);

  const totals = useMemo(() => {
    let expense = 0;
    let income = 0;
    billItems.forEach((item) => {
      if (item.type === "income") {
        income += item.amount;
      } else {
        expense += item.amount;
      }
    });
    return {
      expense,
      income,
      net: income - expense,
    };
  }, [billItems]);

  const dueSummary = useMemo(() => {
    const today = dayjs().startOf("day");
    const summary = {
      overdue: { count: 0, amount: 0 },
      today: { count: 0, amount: 0 },
      soon: { count: 0, amount: 0 },
      later: { count: 0, amount: 0 },
      total: 0,
    };
    filteredItems.forEach((item) => {
      const due = dayjs(item.dueDate).startOf("day");
      const diff = due.diff(today, "day");
      summary.total += item.amount;
      if (diff < 0) {
        summary.overdue.count += 1;
        summary.overdue.amount += item.amount;
      } else if (diff === 0) {
        summary.today.count += 1;
        summary.today.amount += item.amount;
      } else if (diff <= 7) {
        summary.soon.count += 1;
        summary.soon.amount += item.amount;
      } else {
        summary.later.count += 1;
        summary.later.amount += item.amount;
      }
    });
    return summary;
  }, [filteredItems]);

  const calendarLabel = selectedKey
    ? dayjs(selectedKey).format("ddd, DD MMM")
    : monthLabel;
  const billStatusChips = useMemo(
    () => [
      {
        id: "visible",
        label: `${filteredItems.length} matching`,
        color: "blue",
        tooltip:
          filteredItems.length === billItems.length
            ? "All scheduled bills are visible."
            : `${billItems.length} total scheduled bills this month.`,
      },
      {
        id: "overdue",
        label: `${dueSummary.overdue.count} overdue`,
        color: dueSummary.overdue.count > 0 ? "red" : "gray",
        tooltip: "Bills with a due date earlier than today.",
      },
      {
        id: "soon",
        label: `${dueSummary.today.count + dueSummary.soon.count} next 7d`,
        color:
          dueSummary.today.count + dueSummary.soon.count > 0 ? "orange" : "gray",
        tooltip: "Bills due today or within the next 7 days.",
      },
    ],
    [billItems.length, dueSummary, filteredItems.length]
  );
  const savedFilterOptions = useMemo(
    () =>
      savedFilters.map((filter) => ({ value: filter.id, label: filter.name })),
    [savedFilters]
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
  const paymentOptions = useMemo(
    () => [
      { value: "none", label: "No payment method" },
      ...paymentMethods.map((payment) => ({
        value: payment.id,
        label: payment.name,
      })),
    ],
    [paymentMethods]
  );
  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Search: ${search.trim()}`,
        onClear: () => setSearch(""),
      });
    }
    if (sourceFilter !== "all") {
      chips.push({
        key: "source",
        label: `Source: ${
          sourceFilter === "subscription" ? "Subscriptions" : "Recurring"
        }`,
        onClear: () => setSourceFilter("all"),
      });
    }
    if (typeFilter !== "all") {
      chips.push({
        key: "type",
        label: `Type: ${typeFilter === "income" ? "Income" : "Expense"}`,
        onClear: () => setTypeFilter("all"),
      });
    }
    if (filterAccount) {
      chips.push({
        key: "account",
        label: `Account: ${
          filterAccount === "none"
            ? "No linked account"
            : accountMap.get(filterAccount) ?? "Unknown"
        }`,
        onClear: () => setFilterAccount(""),
      });
    }
    if (filterCategory) {
      chips.push({
        key: "category",
        label: `Category: ${
          filterCategory === "uncategorized"
            ? "Uncategorized"
            : categoryMap.get(filterCategory) ?? "Unknown"
        }`,
        onClear: () => setFilterCategory(""),
      });
    }
    if (filterPayment) {
      chips.push({
        key: "payment",
        label: `Payment: ${
          filterPayment === "none"
            ? "No payment method"
            : paymentMap.get(filterPayment) ?? "Unknown"
        }`,
        onClear: () => setFilterPayment(""),
      });
    }
    if (timingFilter !== "all") {
      chips.push({
        key: "timing",
        label: `Due: ${
          timingFilter === "today"
            ? "Today"
            : timingFilter === "soon"
            ? "Next 7 days"
            : timingFilter.charAt(0).toUpperCase() + timingFilter.slice(1)
        }`,
        onClear: () => setTimingFilter("all"),
      });
    }
    if (selectedKey) {
      chips.push({
        key: "day",
        label: `Day: ${dayjs(selectedKey).format("DD MMM")}`,
        onClear: () => setSelectedDate(null),
      });
    }
    return chips;
  }, [
    search,
    sourceFilter,
    typeFilter,
    filterAccount,
    filterCategory,
    filterPayment,
    timingFilter,
    selectedKey,
    accountMap,
    categoryMap,
    paymentMap,
  ]);
  const advancedFilterCount = useMemo(
    () =>
      activeChips.filter(
        (chip) =>
          chip.key !== "search" &&
          chip.key !== "source" &&
          chip.key !== "type" &&
          chip.key !== "day"
      ).length,
    [activeChips]
  );
  const visibleFilterChips = useMemo(
    () =>
      filtersExpanded
        ? activeChips
        : activeChips.filter((chip) => chip.key !== "search"),
    [activeChips, filtersExpanded]
  );
  const persistSavedFilters = (next: SavedFilter<BillsFilterState>[]) => {
    setSavedFilters(next);
    saveSavedFilters(buildFiltersKey(userId), next);
  };
  const handleApplySavedFilter = (id: string | null) => {
    setSelectedSavedId(id);
    if (!id) {
      return;
    }
    const match = savedFilters.find((filter) => filter.id === id);
    if (!match) {
      return;
    }
    const next = normalizeBillsFilters(match.value);
    setSearch(next.search);
    setSourceFilter(next.source);
    setTypeFilter(next.type);
    setFilterAccount(next.accountId);
    setFilterCategory(next.categoryId);
    setFilterPayment(next.paymentId);
    setTimingFilter(next.timing);
  };
  const handleSaveCurrentFilters = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    persistSavedFilters([...savedFilters, { id, name: trimmed, value: currentFilters }]);
    setSelectedSavedId(id);
    setSaveName("");
    setSaveModalOpen(false);
  };
  const handleDeleteSavedFilter = () => {
    if (!selectedSavedId) {
      return;
    }
    const next = savedFilters.filter((filter) => filter.id !== selectedSavedId);
    persistSavedFilters(next);
    setSelectedSavedId(null);
  };
  const handleClearFilters = () => {
    const next = createEmptyBillsFilters();
    setSearch(next.search);
    setSourceFilter(next.source);
    setTypeFilter(next.type);
    setFilterAccount(next.accountId);
    setFilterCategory(next.categoryId);
    setFilterPayment(next.paymentId);
    setTimingFilter(next.timing);
    setSelectedDate(null);
    setSelectedSavedId(null);
  };

  useEffect(() => {
    if (!selectedSavedId) {
      return;
    }
    const match = savedFilters.find((filter) => filter.id === selectedSavedId);
    if (!match) {
      setSelectedSavedId(null);
      return;
    }
    if (!areBillsFiltersEqual(match.value, currentFilters)) {
      setSelectedSavedId(null);
    }
  }, [selectedSavedId, savedFilters, currentFilters]);

  return (
    <Stack gap="lg">
      <Modal
        opened={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save filters"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Filter name"
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="e.g., Overdue bills, Card subscriptions"
            required
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setSaveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<Save size={16} strokeWidth={2} />}
              onClick={handleSaveCurrentFilters}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Bills calendar</Title>
            <Text size="sm" c="dimmed">
              Subscriptions and recurring transactions in one view.
            </Text>
            <PageStatusChips items={billStatusChips} />
          </Stack>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Bills due
          </Text>
          <Title order={3} mt="xs">
            {formatINR(totals.expense)}
          </Title>
          <Text size="sm" c="dimmed">
            {billItems.filter((item) => item.type === "expense").length} expenses
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Recurring income
          </Text>
          <Title order={3} mt="xs">
            {formatINR(totals.income)}
          </Title>
          <Text size="sm" c="dimmed">
            {billItems.filter((item) => item.type === "income").length} incomes
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Net impact
          </Text>
          <Title order={3} mt="xs">
            {formatINR(Math.abs(totals.net))}
          </Title>
          <Text size="sm" c={totals.net >= 0 ? "teal.6" : "red.6"}>
            {totals.net >= 0 ? "Net positive" : "Net negative"}
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap" mb="sm">
          <Stack gap={2}>
            <Title order={5}>Due soon</Title>
            <Text size="sm" c="dimmed">
              Next 7 days and overdue at a glance.
            </Text>
          </Stack>
          <Badge variant="light" color="blue">
            {formatINR(dueSummary.total)} total
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Paper withBorder radius="md" p="xs" style={{ background: "var(--surface-alt)" }}>
            <Text size="xs" c="dimmed">
              Overdue
            </Text>
            <Text fw={600} c="red.6">
              {formatINR(dueSummary.overdue.amount)}
            </Text>
            <Text size="xs" c="dimmed">
              {dueSummary.overdue.count} bills
            </Text>
          </Paper>
          <Paper withBorder radius="md" p="xs" style={{ background: "var(--surface-alt)" }}>
            <Text size="xs" c="dimmed">
              Due today
            </Text>
            <Text fw={600} c="orange.6">
              {formatINR(dueSummary.today.amount)}
            </Text>
            <Text size="xs" c="dimmed">
              {dueSummary.today.count} bills
            </Text>
          </Paper>
          <Paper withBorder radius="md" p="xs" style={{ background: "var(--surface-alt)" }}>
            <Text size="xs" c="dimmed">
              Next 7 days
            </Text>
            <Text fw={600} c="yellow.8">
              {formatINR(dueSummary.soon.amount)}
            </Text>
            <Text size="xs" c="dimmed">
              {dueSummary.soon.count} bills
            </Text>
          </Paper>
          <Paper withBorder radius="md" p="xs" style={{ background: "var(--surface-alt)" }}>
            <Text size="xs" c="dimmed">
              Later
            </Text>
            <Text fw={600}>{formatINR(dueSummary.later.amount)}</Text>
            <Text size="xs" c="dimmed">
              {dueSummary.later.count} bills
            </Text>
          </Paper>
        </SimpleGrid>
      </Paper>

      <Paper withBorder radius="lg" p="md" className="page-filter-panel">
        <Stack gap="sm">
          <Group
            justify="space-between"
            align="flex-end"
            wrap="wrap"
            className="page-filter-toolbar"
          >
            <TextInput
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, category, account, payment, amount"
              size="xs"
              className="page-filter-toolbar-search"
            />
            <Group
              gap="xs"
              align="flex-end"
              wrap="wrap"
              className="page-filter-toolbar-actions"
            >
              <Badge
                variant="light"
                color={hasActiveFilters ? "blue" : "gray"}
                radius="sm"
              >
                {hasActiveFilters ? `${activeChips.length} active` : "No filters"}
              </Badge>
              <Button
                variant={filtersExpanded || advancedFilterCount > 0 ? "light" : "default"}
                size="xs"
                leftSection={<SlidersHorizontal size={14} strokeWidth={2} />}
                rightSection={
                  filtersExpanded ? (
                    <ChevronUp size={14} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={14} strokeWidth={2} />
                  )
                }
                onClick={() => setFiltersExpanded((current) => !current)}
              >
                {filtersExpanded
                  ? "Hide filters"
                  : advancedFilterCount > 0
                  ? `Filters (${advancedFilterCount})`
                  : "Filters"}
              </Button>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                Clear all
              </Button>
              <Popover
                opened={savedPopoverOpen}
                onChange={setSavedPopoverOpen}
                position="bottom-end"
                withArrow
                shadow="md"
              >
                <Popover.Target>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<Save size={14} strokeWidth={2} />}
                  >
                    Filter views
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs">
                    <Select
                      label="Saved views"
                      data={savedFilterOptions}
                      value={selectedSavedId}
                      onChange={(value) => {
                        handleApplySavedFilter(value);
                        setSavedPopoverOpen(false);
                      }}
                      placeholder="Choose"
                      clearable
                      size="xs"
                    />
                    <Group grow>
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Save size={14} strokeWidth={2} />}
                        onClick={() => {
                          setSavedPopoverOpen(false);
                          setSaveModalOpen(true);
                        }}
                      >
                        Save current
                      </Button>
                      <Button
                        variant="light"
                        size="xs"
                        color="red"
                        leftSection={<Trash2 size={14} strokeWidth={2} />}
                        onClick={() => {
                          handleDeleteSavedFilter();
                          setSavedPopoverOpen(false);
                        }}
                        disabled={!selectedSavedId}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </Group>
          </Group>
          <ActiveFilterChips items={visibleFilterChips} />
          <Collapse in={filtersExpanded}>
            <SimpleGrid
              cols={{ base: 1, sm: 2, md: 3, xl: 5 }}
              spacing="sm"
              className="page-filter-advanced"
            >
              <Select
                label="Account"
                data={accountOptions}
                value={filterAccount || null}
                onChange={(value) => setFilterAccount(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Select
                label="Category"
                data={categoryOptions}
                value={filterCategory || null}
                onChange={(value) => setFilterCategory(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Select
                label="Payment"
                data={paymentOptions}
                value={filterPayment || null}
                onChange={(value) => setFilterPayment(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Select
                label="Due status"
                data={[
                  { value: "overdue", label: "Overdue" },
                  { value: "today", label: "Today" },
                  { value: "soon", label: "Next 7 days" },
                  { value: "later", label: "Later" },
                ]}
                value={timingFilter === "all" ? null : timingFilter}
                onChange={(value) =>
                  setTimingFilter(
                    value === "overdue" ||
                      value === "today" ||
                      value === "soon" ||
                      value === "later"
                      ? value
                      : "all"
                  )
                }
                clearable
                size="xs"
              />
            </SimpleGrid>
          </Collapse>
        </Stack>
      </Paper>

      <div className="page-grid">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Group justify="space-between" align="center" mb="sm">
            <Group gap="xs" align="center">
              <CalendarDays size={18} />
              <Text fw={600}>{calendarLabel}</Text>
            </Group>
            {selectedKey ? (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => setSelectedDate(null)}
              >
                Clear day
              </Button>
            ) : null}
          </Group>
          <DatePicker
            date={monthStart.format("YYYY-MM-DD")}
            value={selectedKey}
            onChange={(value) => {
              if (!value) {
                setSelectedDate(null);
                return;
              }
              if (value === selectedDate) {
                setSelectedDate(null);
                return;
              }
              setSelectedDate(value);
            }}
            onNextMonth={(value) => setMonth(dayjs(value).format("YYYY-MM"))}
            onPreviousMonth={(value) => setMonth(dayjs(value).format("YYYY-MM"))}
            onMonthSelect={(value) => setMonth(dayjs(value).format("YYYY-MM"))}
            getDayProps={(date) => {
              const key = dayjs(date).format("YYYY-MM-DD");
              if (!dueDates.has(key)) {
                return {};
              }
              return {
                className: "bill-calendar-day",
              };
            }}
          />
          <Text size="xs" c="dimmed" mt="sm">
            Tap a date to filter the list. Dots show scheduled bills.
          </Text>
        </Paper>

        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Group justify="space-between" align="center" mb="sm" wrap="wrap">
            <Stack gap={2}>
              <Title order={5}>Scheduled bills</Title>
              <Text size="sm" c="dimmed">
                {selectedKey
                  ? `Showing ${visibleItems.length} due on ${dayjs(
                      selectedKey
                    ).format("DD MMM")}`
                  : `All bills for ${monthLabel}`}
              </Text>
            </Stack>
            <Badge variant="light" color="gray">
              {visibleItems.length} items
            </Badge>
          </Group>
          <Group justify="space-between" align="center" mb="sm" wrap="wrap">
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="xs" c="dimmed">
                Source
              </Text>
              <SegmentedControl
                size="xs"
                value={sourceFilter}
                onChange={(value) =>
                  setSourceFilter(value as "all" | "subscription" | "recurring")
                }
                data={[
                  { value: "all", label: "All" },
                  { value: "subscription", label: "Subscriptions" },
                  { value: "recurring", label: "Recurring" },
                ]}
              />
            </Group>
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="xs" c="dimmed">
                Type
              </Text>
              <SegmentedControl
                size="xs"
                value={typeFilter}
                onChange={(value) =>
                  setTypeFilter(value as "all" | "expense" | "income")
                }
                data={[
                  { value: "all", label: "All" },
                  { value: "expense", label: "Expense" },
                  { value: "income", label: "Income" },
                ]}
              />
            </Group>
          </Group>
          {billItems.length === 0 ? (
            <EmptyState
              title="No bills yet"
              description="Add subscriptions or mark transactions as recurring to build your calendar."
              action={{
                label: "Add subscription",
                to: appPath("/subscriptions?action=new"),
              }}
            />
          ) : groupedItems.length === 0 ? (
            <EmptyState
              description={
                selectedKey
                  ? "No bills scheduled for the selected day."
                  : "No bills match the current filters."
              }
            />
          ) : (
            <Stack gap="md">
              {groupedItems.map(([date, items]) => {
                const dateLabel = dayjs(date).format("ddd, DD MMM");
                const daysAway = dayjs(date).diff(dayjs(), "day");
                let statusLabel = "Scheduled";
                let statusColor = "gray";
                if (isCurrentMonth) {
                  if (daysAway < 0) {
                    statusLabel = "Overdue";
                    statusColor = "red";
                  } else if (daysAway === 0) {
                    statusLabel = "Due today";
                    statusColor = "orange";
                  } else if (daysAway <= 7) {
                    statusLabel = "Due soon";
                    statusColor = "yellow";
                  }
                }

                return (
                  <Stack key={date} gap="sm">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <Group gap="xs" align="center">
                        <Text fw={600}>{dateLabel}</Text>
                        <Badge variant="light" color={statusColor} radius="sm">
                          {statusLabel}
                        </Badge>
                      </Group>
                      <Badge variant="light" color="blue" radius="sm">
                        {items.length} items
                      </Badge>
                    </Group>
                    {items.map((item) => (
                      <Paper
                        key={item.id}
                        withBorder
                        radius="md"
                        p="sm"
                        style={{ background: "var(--surface-alt)" }}
                      >
                        <Group justify="space-between" align="center" wrap="wrap">
                          <Stack gap={4} style={{ minWidth: 200 }}>
                            <Group gap="xs" align="center" wrap="wrap">
                              <Badge
                                variant="light"
                                color={item.source === "subscription" ? "blue" : "grape"}
                                radius="sm"
                              >
                                {item.source === "subscription" ? "Subscription" : "Recurring"}
                              </Badge>
                              <Badge
                                variant="light"
                                color={item.type === "income" ? "teal" : "red"}
                                radius="sm"
                              >
                                {item.type === "income" ? "Income" : "Expense"}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {item.cadence}
                              </Text>
                            </Group>
                            <Text fw={600}>{item.title}</Text>
                            <Text size="xs" c="dimmed">
                              {item.category} · {item.account} · {item.payment}
                            </Text>
                          </Stack>
                          <Stack gap={2} align="flex-end">
                            <Text
                              fw={700}
                              c={item.type === "income" ? "teal.6" : "red.6"}
                            >
                              {item.type === "income" ? "+" : "-"}
                              {formatINR(item.amount)}
                            </Text>
                            {item.amountDetail ? (
                              <Text size="xs" c="dimmed">
                                {item.amountDetail}
                              </Text>
                            ) : null}
                            <Group gap={6} align="center">
                              {item.source === "recurring" ? (
                                <Repeat size={12} />
                              ) : null}
                              <Text size="xs" c="dimmed">
                                Due {dayjs(item.dueDate).format("DD MMM")}
                              </Text>
                            </Group>
                          </Stack>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Paper>
      </div>
    </Stack>
  );
};
