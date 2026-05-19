import {
  Badge,
  Button,
  Collapse,
  Group,
  MultiSelect,
  Modal,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { ChevronDown, ChevronUp, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { CashflowHeader } from "../components/cashflow/CashflowHeader";
import { CashflowSummaryCards } from "../components/cashflow/CashflowSummaryCards";
import { CashflowWeeklyChart } from "../components/cashflow/CashflowWeeklyChart";
import { CashflowCategoryTables } from "../components/cashflow/CashflowCategoryTables";
import { ReportsViewToggle } from "../components/reports/ReportsViewToggle";
import { useAppSelector } from "../app/hooks";
import { useCashflowData } from "../hooks/useCashflowData";
import { useAppMonth } from "../context/AppMonthContext";
import { formatINR } from "../lib/format";
import {
  loadSavedFilters,
  saveSavedFilters,
  type SavedFilter,
} from "../lib/savedFilters";
import {
  areTransactionFiltersEqual,
  createEmptyTransactionFilters,
  normalizeTransactionFilters,
  type TransactionFilterState,
} from "../lib/transactionFilters";
import {
  getDisplayCategoryId,
  getTransactionCounterpartyName,
} from "../lib/transactions";

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:cashflow:${userId ?? "anon"}`;

const summarizeValues = (values: string[]) => {
  if (values.length <= 2) {
    return values.join(", ");
  }
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
};

const flagOptions = [
  { value: "recurring", label: "Recurring" },
  { value: "shared", label: "Shared" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "uncategorized", label: "Uncategorized" },
  { value: "untagged", label: "Untagged" },
  { value: "has-notes", label: "Has notes" },
];

export const Cashflow = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { month } = useAppMonth();
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<
    Exclude<TransactionFilterState["type"], "transfer">
  >("");
  const [filterFlags, setFilterFlags] = useState<string[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<TransactionFilterState>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));

  useEffect(() => {
    setSavedFilters(loadSavedFilters(buildFiltersKey(userId)));
  }, [userId]);

  const currentFilters = useMemo(
    () =>
      normalizeTransactionFilters({
        search,
        accountId: filterAccount,
        categoryId: filterCategory,
        paymentId: filterPayment,
        tags: filterTags,
        type: filterType,
        flags: filterFlags,
        dateFrom: filterFrom,
        dateTo: filterTo,
        minAmount,
        maxAmount,
      }),
    [
      search,
      filterAccount,
      filterCategory,
      filterPayment,
      filterTags,
      filterType,
      filterFlags,
      filterFrom,
      filterTo,
      minAmount,
      maxAmount,
    ]
  );

  const {
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
    filteredCount,
    totalCount,
    recurringCount,
    sharedCount,
    reimbursementCount,
    savingsRate,
    expenseRows,
    incomeRows,
    totalIncome,
    totalExpense,
    net,
    incomeCount,
    expenseCount,
    weeklyData,
  } = useCashflowData({
    month,
    filters: currentFilters,
  });

  const hasActiveFilters = useMemo(
    () =>
      !areTransactionFiltersEqual(
        currentFilters,
        createEmptyTransactionFilters()
      ),
    [currentFilters]
  );

  const savedFilterOptions = useMemo(
    () =>
      savedFilters.map((filter) => ({ value: filter.id, label: filter.name })),
    [savedFilters]
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
    if (filterType) {
      chips.push({
        key: "type",
        label: `Type: ${filterType === "income" ? "Income" : "Expense"}`,
        onClear: () => setFilterType(""),
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
    if (filterTags.length > 0) {
      chips.push({
        key: "tags",
        label: `Tags: ${summarizeValues(filterTags)}`,
        onClear: () => setFilterTags([]),
      });
    }
    if (filterFlags.length > 0) {
      chips.push({
        key: "flags",
        label: `Flags: ${summarizeValues(filterFlags)}`,
        onClear: () => setFilterFlags([]),
      });
    }
    if (filterFrom || filterTo) {
      const fromLabel = filterFrom ? dayjs(filterFrom).format("DD MMM") : "Any";
      const toLabel = filterTo ? dayjs(filterTo).format("DD MMM") : "Any";
      chips.push({
        key: "date",
        label: `Date: ${fromLabel} → ${toLabel}`,
        onClear: () => {
          setFilterFrom("");
          setFilterTo("");
        },
      });
    }
    if (minAmount || maxAmount) {
      const minLabel = minAmount ? formatINR(Number(minAmount)) : "Any";
      const maxLabel = maxAmount ? formatINR(Number(maxAmount)) : "Any";
      chips.push({
        key: "amount",
        label: `Amount: ${minLabel} – ${maxLabel}`,
        onClear: () => {
          setMinAmount("");
          setMaxAmount("");
        },
      });
    }
    return chips;
  }, [
    search,
    filterType,
    filterAccount,
    filterCategory,
    filterPayment,
    filterTags,
    filterFlags,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    accountMap,
    categoryMap,
    paymentMap,
  ]);
  const advancedFilterCount = useMemo(
    () => activeChips.filter((chip) => chip.key !== "search").length,
    [activeChips]
  );
  const visibleFilterChips = filtersExpanded
    ? activeChips
    : activeChips.filter((chip) => chip.key !== "search");

  const persistSavedFilters = (next: SavedFilter<TransactionFilterState>[]) => {
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
    const next = normalizeTransactionFilters(match.value);
    setSearch(next.search);
    setFilterAccount(next.accountId);
    setFilterCategory(next.categoryId);
    setFilterPayment(next.paymentId);
    setFilterTags(next.tags);
    setFilterType(next.type === "transfer" ? "" : next.type);
    setFilterFlags(next.flags);
    setFilterFrom(next.dateFrom);
    setFilterTo(next.dateTo);
    setMinAmount(next.minAmount);
    setMaxAmount(next.maxAmount);
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
    const next = createEmptyTransactionFilters();
    setSearch(next.search);
    setFilterAccount(next.accountId);
    setFilterCategory(next.categoryId);
    setFilterPayment(next.paymentId);
    setFilterTags(next.tags);
    setFilterType("");
    setFilterFlags(next.flags);
    setFilterFrom(next.dateFrom);
    setFilterTo(next.dateTo);
    setMinAmount(next.minAmount);
    setMaxAmount(next.maxAmount);
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
    if (!areTransactionFiltersEqual(match.value, currentFilters)) {
      setSelectedSavedId(null);
    }
  }, [selectedSavedId, savedFilters, currentFilters]);

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      return;
    }

    const escape = (value: string) => {
      const escaped = value.replaceAll('"', '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const header = [
      "Date",
      "Type",
      "Counterparty",
      "Category",
      "Amount",
      "Account",
      "Payment Method",
      "Tags",
      "Notes",
    ];

    const rows = filteredTransactions.map((tx) => {
      const displayCategoryId = getDisplayCategoryId(tx);
      return [
        tx.date,
        tx.type,
        getTransactionCounterpartyName(tx),
        categoryMap.get(displayCategoryId ?? "") ?? "Uncategorized",
        tx.amount.toFixed(2),
        accountMap.get(tx.account_id ?? "") ?? "-",
        paymentMap.get(tx.payment_method_id ?? "") ?? "-",
        tx.tags?.map((tag) => tag.name).join(" | ") ?? "",
        tx.notes ?? "",
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escape(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sanchay-cashflow-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="lg">
      <Modal
        opened={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save filter view"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="View name"
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="e.g., Salary inflow, Card spend"
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

      <CashflowHeader
        monthLabel={monthLabel}
        filteredCount={filteredCount}
        totalCount={totalCount}
        recurringCount={recurringCount}
        sharedCount={sharedCount}
        reimbursementCount={reimbursementCount}
        onExport={handleExport}
        viewToggle={<ReportsViewToggle value="cashflow" />}
      />

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
              placeholder="Counterparty, category, account, notes, amount"
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
                label="Type"
                data={[
                  { value: "expense", label: "Expense" },
                  { value: "income", label: "Income" },
                ]}
                value={filterType || null}
                onChange={(value) =>
                  setFilterType(
                    value === "expense" || value === "income" ? value : ""
                  )
                }
                clearable
                size="xs"
              />
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
              <MultiSelect
                label="Tags"
                data={tagSelectOptions}
                value={filterTags}
                onChange={setFilterTags}
                searchable
                clearable
                placeholder="Any tags"
                size="xs"
              />
              <MultiSelect
                label="Flags"
                data={flagOptions}
                value={filterFlags}
                onChange={setFilterFlags}
                clearable
                placeholder="Any flags"
                size="xs"
              />
              <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                <DateInput
                  label="From"
                  value={filterFrom ? dayjs(filterFrom).toDate() : null}
                  onChange={(value) =>
                    setFilterFrom(value ? dayjs(value).format("YYYY-MM-DD") : "")
                  }
                  clearable
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
                <DateInput
                  label="To"
                  value={filterTo ? dayjs(filterTo).toDate() : null}
                  onChange={(value) =>
                    setFilterTo(value ? dayjs(value).format("YYYY-MM-DD") : "")
                  }
                  clearable
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
              </Group>
              <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                <TextInput
                  label="Min"
                  type="number"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
                <TextInput
                  label="Max"
                  type="number"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
              </Group>
            </SimpleGrid>
          </Collapse>
        </Stack>
      </Paper>

      <CashflowSummaryCards
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        net={net}
        incomeCount={incomeCount}
        expenseCount={expenseCount}
        savingsRate={savingsRate}
      />

      <CashflowWeeklyChart
        weeklyData={weeklyData}
        hasData={filteredTransactions.length > 0}
      />

      <CashflowCategoryTables
        expenseRows={expenseRows}
        incomeRows={incomeRows}
        isLoading={isTransactionsLoading}
      />
    </Stack>
  );
};
