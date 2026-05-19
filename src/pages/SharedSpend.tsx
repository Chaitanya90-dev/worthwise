import {
  Badge,
  Button,
  Collapse,
  Group,
  Modal,
  MultiSelect,
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
import { DateInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Save,
  SlidersHorizontal,
  Tag,
  Trash2,
} from "lucide-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetSharedExpensesQuery,
  useGetTagsQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { DatatrixTable } from "../components/DatatrixTable";
import { PageStatusChips } from "../components/common/PageStatusChips";
import { TransactionFormModal } from "../components/transactions/TransactionFormModal";
import { TransactionsViewToggle } from "../components/transactions/TransactionsViewToggle";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { useAppSelector } from "../app/hooks";
import { formatINR } from "../lib/format";
import { scoreSearchMatch } from "../lib/globalSearch";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import {
  getDisplayCategoryId,
  getTransactionCounterpartyName,
  isReimbursement,
} from "../lib/transactions";
import type { Transaction } from "../types/finance";
import { useAppMonth } from "../context/AppMonthContext";

type NetRow = {
  id: string;
  label: string;
  expected: number;
  received: number;
  remaining: number;
};

type ReimbursementRow = {
  id: string;
  date: string;
  category: string;
  account: string;
  participant: string;
  tags: string;
  notes: string;
  amount: number;
};

type SharedSpendFilters = {
  search: string;
  accountId: string;
  categoryId: string;
  paymentId: string;
  tags: string[];
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  groupBy: "tag" | "category";
};

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:shared-spend:${userId ?? "anon"}`;

const createEmptySharedSpendFilters = (): SharedSpendFilters => ({
  search: "",
  accountId: "",
  categoryId: "",
  paymentId: "",
  tags: [],
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
  groupBy: "tag",
});

const normalizeSharedSpendFilters = (
  value: Partial<SharedSpendFilters> = {}
): SharedSpendFilters => ({
  search: value.search?.trim() ?? "",
  accountId: value.accountId?.trim() ?? "",
  categoryId: value.categoryId?.trim() ?? "",
  paymentId: value.paymentId?.trim() ?? "",
  tags: Array.from(new Set((value.tags ?? []).map((tag) => tag.trim()).filter(Boolean))).sort(),
  dateFrom: value.dateFrom?.trim() ?? "",
  dateTo: value.dateTo?.trim() ?? "",
  minAmount: value.minAmount?.trim() ?? "",
  maxAmount: value.maxAmount?.trim() ?? "",
  groupBy: value.groupBy === "category" ? "category" : "tag",
});

const areSharedSpendFiltersEqual = (
  left: Partial<SharedSpendFilters>,
  right: Partial<SharedSpendFilters>
) =>
  JSON.stringify(normalizeSharedSpendFilters(left)) ===
  JSON.stringify(normalizeSharedSpendFilters(right));

const NetCell = (params: ICellRendererParams<NetRow>) => {
  const remaining = params.data?.remaining ?? 0;
  let label = "Settled";
  let color = "gray";
  let amountColor = "dimmed";

  if (remaining > 0) {
    label = "Outstanding";
    color = "orange";
    amountColor = "red.6";
  } else if (remaining < 0) {
    label = "Overpaid";
    color = "teal";
    amountColor = "teal.6";
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Text fw={600} c={amountColor}>
        {formatINR(Math.abs(remaining))}
      </Text>
      <Badge variant="light" color={color} radius="sm">
        {label}
      </Badge>
    </Group>
  );
};

export const SharedSpend = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { month } = useAppMonth();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [groupBy, setGroupBy] = useState<"tag" | "category">("tag");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<SharedSpendFilters>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));

  useEffect(() => {
    setSavedFilters(loadSavedFilters(buildFiltersKey(userId)));
  }, [userId]);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: tags = [] } = useGetTagsQuery();
  const { data: transactions = [], isLoading } = useGetTransactionsQuery({
    month,
  });
  const { data: sharedExpenses = [], isLoading: isSharedLoading } =
    useGetSharedExpensesQuery();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods]
  );

  const effectiveGroupBy = tags.length === 0 ? "category" : groupBy;
  const currentFilters = useMemo(
    () =>
      normalizeSharedSpendFilters({
        search,
        accountId: filterAccount,
        categoryId: filterCategory,
        paymentId: filterPayment,
        tags: filterTags,
        dateFrom: filterFrom,
        dateTo: filterTo,
        minAmount,
        maxAmount,
        groupBy,
      }),
    [
      search,
      filterAccount,
      filterCategory,
      filterPayment,
      filterTags,
      filterFrom,
      filterTo,
      minAmount,
      maxAmount,
      groupBy,
    ]
  );
  const hasActiveFilters = useMemo(
    () =>
      !areSharedSpendFiltersEqual(
        currentFilters,
        createEmptySharedSpendFilters()
      ),
    [currentFilters]
  );

  const sharedExpensesForMonth = useMemo(
    () =>
      sharedExpenses.filter((shared) =>
        dayjs(shared.transaction.date).isSame(month, "month")
      ),
    [sharedExpenses, month]
  );
  const normalizedDateFrom =
    filterFrom && filterTo && filterFrom > filterTo ? filterTo : filterFrom;
  const normalizedDateTo =
    filterFrom && filterTo && filterFrom > filterTo ? filterFrom : filterTo;
  const minValue = minAmount.trim() ? Number(minAmount) : null;
  const maxValue = maxAmount.trim() ? Number(maxAmount) : null;
  const normalizedMinAmount =
    minValue !== null &&
    maxValue !== null &&
    Number.isFinite(minValue) &&
    Number.isFinite(maxValue) &&
    minValue > maxValue
      ? maxValue
      : minValue;
  const normalizedMaxAmount =
    minValue !== null &&
    maxValue !== null &&
    Number.isFinite(minValue) &&
    Number.isFinite(maxValue) &&
    minValue > maxValue
      ? minValue
      : maxValue;
  const searchQuery = search.trim();

  const matchesSharedFilters = (tx: Transaction) => {
    if (filterAccount && tx.account_id !== filterAccount) {
      return false;
    }
    const displayCategoryId = getDisplayCategoryId(tx);
    if (filterCategory === "uncategorized" && displayCategoryId) {
      return false;
    }
    if (
      filterCategory &&
      filterCategory !== "uncategorized" &&
      displayCategoryId !== filterCategory
    ) {
      return false;
    }
    if (filterPayment === "none" && tx.payment_method_id) {
      return false;
    }
    if (
      filterPayment &&
      filterPayment !== "none" &&
      tx.payment_method_id !== filterPayment
    ) {
      return false;
    }
    if (
      filterTags.length > 0 &&
      !filterTags.every((tag) => tx.tags?.some((existingTag) => existingTag.name === tag))
    ) {
      return false;
    }
    if (normalizedDateFrom && tx.date < normalizedDateFrom) {
      return false;
    }
    if (normalizedDateTo && tx.date > normalizedDateTo) {
      return false;
    }
    if (
      normalizedMinAmount !== null &&
      Number.isFinite(normalizedMinAmount) &&
      Number(tx.amount) < normalizedMinAmount
    ) {
      return false;
    }
    if (
      normalizedMaxAmount !== null &&
      Number.isFinite(normalizedMaxAmount) &&
      Number(tx.amount) > normalizedMaxAmount
    ) {
      return false;
    }
    if (!searchQuery) {
      return true;
    }

    const categoryLabel = displayCategoryId
      ? categoryMap.get(displayCategoryId) ?? "Uncategorized"
      : "Uncategorized";
    const accountLabel = tx.account_id ? accountMap.get(tx.account_id) ?? "" : "";
    const paymentLabel = tx.payment_method_id
      ? paymentMap.get(tx.payment_method_id) ?? ""
      : "";
    const tagsLabel = tx.tags?.map((tag) => tag.name) ?? [];
    return (
      scoreSearchMatch({
        query: searchQuery,
        primaryText: getTransactionCounterpartyName(tx) || categoryLabel || tx.type,
        aliasTexts: [
          categoryLabel,
          accountLabel,
          paymentLabel,
          tx.notes ?? "",
          tx.type,
          ...tagsLabel,
        ],
        valueTexts: [
          tx.amount.toString(),
          formatINR(tx.amount),
          dayjs(tx.date).format("DD MMM YYYY"),
        ],
      }) !== null
    );
  };

  const filteredTransactions = useMemo(
    () => transactions.filter((tx) => matchesSharedFilters(tx)),
    [
      transactions,
      filterAccount,
      filterCategory,
      filterPayment,
      filterTags,
      normalizedDateFrom,
      normalizedDateTo,
      normalizedMinAmount,
      normalizedMaxAmount,
      searchQuery,
      categoryMap,
      accountMap,
      paymentMap,
    ]
  );

  const filteredSharedExpenses = useMemo(
    () => sharedExpensesForMonth.filter((shared) => matchesSharedFilters(shared.transaction)),
    [
      sharedExpensesForMonth,
      filterAccount,
      filterCategory,
      filterPayment,
      filterTags,
      normalizedDateFrom,
      normalizedDateTo,
      normalizedMinAmount,
      normalizedMaxAmount,
      searchQuery,
      categoryMap,
      accountMap,
      paymentMap,
    ]
  );

  const reimbursementTransactions = useMemo(
    () => filteredTransactions.filter((tx) => isReimbursement(tx)),
    [filteredTransactions]
  );

  const sharedExpenseTransactionIds = useMemo(
    () => new Set(sharedExpensesForMonth.map((shared) => shared.transaction.id)),
    [sharedExpensesForMonth]
  );

  const legacySharedTransactions = useMemo(
    () =>
      filteredTransactions.filter(
        (tx) =>
          tx.type === "expense" &&
          Boolean(tx.is_shared) &&
          !sharedExpenseTransactionIds.has(tx.id)
      ),
    [filteredTransactions, sharedExpenseTransactionIds]
  );

  const linkedReimbursements = useMemo(
    () =>
      filteredSharedExpenses.flatMap((shared) =>
        shared.reimbursements.map((reimbursement) => ({
          ...reimbursement,
          sharedExpenseId: shared.id,
          sharedExpense: shared,
        }))
      ),
    [filteredSharedExpenses]
  );

  const linkedReimbursementIds = useMemo(
    () => new Set(linkedReimbursements.map((item) => item.transaction_id)),
    [linkedReimbursements]
  );

  const legacyReimbursementCount = useMemo(
    () =>
      reimbursementTransactions.filter((tx) => !linkedReimbursementIds.has(tx.id))
        .length,
    [reimbursementTransactions, linkedReimbursementIds]
  );

  const summary = useMemo(() => {
    let expected = 0;
    let received = 0;
    let outlay = 0;
    let yourShare = 0;

    filteredSharedExpenses.forEach((shared) => {
      const total = shared.transaction.amount;
      const expectedReimb = shared.participants.reduce(
        (sum, participant) => sum + participant.share_amount,
        0
      );
      const receivedReimb = shared.reimbursements.reduce(
        (sum, reimbursement) => sum + reimbursement.transaction.amount,
        0
      );
      outlay += total;
      expected += expectedReimb;
      received += receivedReimb;
      const share = total - expectedReimb;
      if (share > 0) {
        yourShare += share;
      }
    });

    return {
      expected,
      received,
      outstanding: expected - received,
      outlay,
      yourShare,
    };
  }, [filteredSharedExpenses]);

  const sharedBreakdowns = useMemo(() => {
    return filteredSharedExpenses.map((shared) => {
      const expected = shared.participants.reduce(
        (sum, participant) => sum + participant.share_amount,
        0
      );
      const received = shared.reimbursements.reduce(
        (sum, reimbursement) => sum + reimbursement.transaction.amount,
        0
      );
      const participantBreakdown = shared.participants.map((participant) => {
        const receivedFor = shared.reimbursements
          .filter((reimbursement) => reimbursement.participant_id === participant.id)
          .reduce(
            (sum, reimbursement) => sum + reimbursement.transaction.amount,
            0
          );
        return {
          ...participant,
          received: receivedFor,
          remaining: participant.share_amount - receivedFor,
        };
      });
      return {
        shared,
        expected,
        received,
        remaining: expected - received,
        yourShare: Math.max(shared.transaction.amount - expected, 0),
        participants: participantBreakdown,
      };
    });
  }, [filteredSharedExpenses]);

  const isSharedLoadingState = isLoading || isSharedLoading;

  const netRows = useMemo<NetRow[]>(() => {
    const map = new Map<string, { label: string; expected: number; received: number }>();

    filteredSharedExpenses.forEach((shared) => {
      const expectedReimb = shared.participants.reduce(
        (sum, participant) => sum + participant.share_amount,
        0
      );
      const receivedReimb = shared.reimbursements.reduce(
        (sum, reimbursement) => sum + reimbursement.transaction.amount,
        0
      );
      const tx = shared.transaction;

      if (effectiveGroupBy === "tag") {
        const tagList = tx.tags?.map((tag) => tag.name) ?? [];
        if (tagList.length === 0) {
          const current = map.get("untagged") ?? {
            label: "Unassigned",
            expected: 0,
            received: 0,
          };
          current.expected += expectedReimb;
          current.received += receivedReimb;
          map.set("untagged", current);
          return;
        }
        tagList.forEach((tag) => {
          const current = map.get(tag) ?? {
            label: tag,
            expected: 0,
            received: 0,
          };
          current.expected += expectedReimb;
          current.received += receivedReimb;
          map.set(tag, current);
        });
        return;
      }

      const categoryId = getDisplayCategoryId(tx) ?? "uncategorized";
      const label =
        categoryId === "uncategorized"
          ? "Uncategorized"
          : categoryMap.get(categoryId) ?? categoryId;
      const current = map.get(categoryId) ?? {
        label,
        expected: 0,
        received: 0,
      };
      current.expected += expectedReimb;
      current.received += receivedReimb;
      map.set(categoryId, current);
    });

    return Array.from(map.entries())
      .map(([id, data]) => ({
        id,
        label: data.label,
        expected: data.expected,
        received: data.received,
        remaining: data.expected - data.received,
      }))
      .sort((a, b) => Math.abs(b.remaining) - Math.abs(a.remaining));
  }, [filteredSharedExpenses, effectiveGroupBy, categoryMap]);

  const reimbursementRows = useMemo<ReimbursementRow[]>(() => {
    const linkedRows = linkedReimbursements.map((reimbursement) => {
      const shared = reimbursement.sharedExpense;
      const participant = shared.participants.find(
        (item) => item.id === reimbursement.participant_id
      );
      const reimbursementTx = reimbursement.transaction;
      const displayCategoryId = getDisplayCategoryId(reimbursementTx);
      const categoryLabel = displayCategoryId
        ? categoryMap.get(displayCategoryId) ?? displayCategoryId
        : "Uncategorized";
      const accountLabel = reimbursementTx.account_id
        ? accountMap.get(reimbursementTx.account_id) ?? "-"
        : "-";
      return {
        id: reimbursement.transaction_id,
        date: dayjs(reimbursement.transaction.date).format("DD MMM"),
        category: categoryLabel,
        account: accountLabel,
        participant: participant?.name ?? "Unassigned",
        tags: reimbursementTx.tags?.length
          ? reimbursementTx.tags.map((tag) => tag.name).join(", ")
          : "-",
        notes: reimbursement.transaction.notes?.trim() ?? "-",
        amount: reimbursement.transaction.amount,
      };
    });

    const legacyRows = reimbursementTransactions
      .filter((tx) => !linkedReimbursementIds.has(tx.id))
      .map((tx) => {
        const displayCategoryId = getDisplayCategoryId(tx);
        const categoryLabel = displayCategoryId
          ? categoryMap.get(displayCategoryId) ?? displayCategoryId
          : "Uncategorized";
        const accountLabel = tx.account_id
          ? accountMap.get(tx.account_id) ?? "-"
          : "-";
        return {
          id: tx.id,
          date: dayjs(tx.date).format("DD MMM"),
          category: categoryLabel,
          account: accountLabel,
          participant: "Unlinked",
          tags: tx.tags?.length ? tx.tags.map((tag) => tag.name).join(", ") : "-",
          notes: tx.notes?.trim() ?? "-",
          amount: tx.amount,
        };
      });

    return [...linkedRows, ...legacyRows];
  }, [
    linkedReimbursements,
    reimbursementTransactions,
    linkedReimbursementIds,
    categoryMap,
    accountMap,
  ]);

  const netColumns = useMemo<ColDef<NetRow>[]>(
    () => [
      {
        headerName: effectiveGroupBy === "tag" ? "Tag" : "Category",
        field: "label",
        flex: 1.4,
      },
      {
        headerName: "Expected",
        field: "expected",
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Received",
        field: "received",
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Remaining",
        field: "remaining",
        cellRenderer: NetCell,
        flex: 1.2,
      },
    ],
    [effectiveGroupBy]
  );

  const reimbursementColumns = useMemo<ColDef<ReimbursementRow>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 120 },
      { headerName: "Category", field: "category", flex: 1.2 },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "From", field: "participant", flex: 1 },
      {
        headerName: "Tags",
        field: "tags",
        flex: 1.1,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Notes",
        field: "notes",
        flex: 1.6,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 160,
        valueFormatter: (params) =>
          `+${formatINR(Number(params.value ?? 0))}`,
        cellClass: "datatrix-cell-positive",
      },
    ],
    []
  );

  const selectedTransaction = useMemo<Transaction | null>(() => {
    if (!editingTransactionId) {
      return null;
    }
    return transactions.find((tx) => tx.id === editingTransactionId) ?? null;
  }, [transactions, editingTransactionId]);

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Search: ${search.trim()}`,
        onClear: () => setSearch(""),
      });
    }
    if (filterAccount) {
      chips.push({
        key: "account",
        label: `Account: ${accountMap.get(filterAccount) ?? "Unknown"}`,
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
        label:
          filterTags.length <= 2
            ? `Tags: ${filterTags.join(", ")}`
            : `Tags: ${filterTags.slice(0, 2).join(", ")} +${
                filterTags.length - 2
              }`,
        onClear: () => setFilterTags([]),
      });
    }
    if (filterFrom || filterTo) {
      const fromLabel = filterFrom
        ? dayjs(filterFrom).format("DD MMM")
        : "Any";
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
    if (groupBy !== "tag") {
      chips.push({
        key: "group",
        label: "Group: Category",
        onClear: () => setGroupBy("tag"),
      });
    }
    return chips;
  }, [
    search,
    filterAccount,
    filterCategory,
    filterPayment,
    filterTags,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    groupBy,
    accountMap,
    categoryMap,
    paymentMap,
  ]);
  const advancedFilterCount = useMemo(
    () => activeChips.filter((chip) => chip.key !== "search" && chip.key !== "group").length,
    [activeChips]
  );
  const visibleFilterChips = useMemo(
    () =>
      filtersExpanded
        ? activeChips
        : activeChips.filter((chip) => chip.key !== "search"),
    [activeChips, filtersExpanded]
  );
  const savedFilterOptions = useMemo(
    () =>
      savedFilters.map((filter) => ({ value: filter.id, label: filter.name })),
    [savedFilters]
  );
  const persistSavedFilters = (next: SavedFilter<SharedSpendFilters>[]) => {
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
    const next = normalizeSharedSpendFilters(match.value);
    setSearch(next.search);
    setFilterAccount(next.accountId);
    setFilterCategory(next.categoryId);
    setFilterPayment(next.paymentId);
    setFilterTags(next.tags);
    setFilterFrom(next.dateFrom);
    setFilterTo(next.dateTo);
    setMinAmount(next.minAmount);
    setMaxAmount(next.maxAmount);
    setGroupBy(next.groupBy);
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
    const next = createEmptySharedSpendFilters();
    setSearch(next.search);
    setFilterAccount(next.accountId);
    setFilterCategory(next.categoryId);
    setFilterPayment(next.paymentId);
    setFilterTags(next.tags);
    setFilterFrom(next.dateFrom);
    setFilterTo(next.dateTo);
    setMinAmount(next.minAmount);
    setMaxAmount(next.maxAmount);
    setGroupBy(next.groupBy);
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
    if (!areSharedSpendFiltersEqual(match.value, currentFilters)) {
      setSelectedSavedId(null);
    }
  }, [selectedSavedId, savedFilters, currentFilters]);

  const countLabel = `${linkedReimbursements.length + legacyReimbursementCount} reimbursements`;
  const outstandingLabel =
    summary.outstanding > 0
      ? "Outstanding"
      : summary.outstanding < 0
        ? "Overpaid"
        : "Settled";
  let outstandingTone = "dimmed";
  if (summary.outstanding > 0) {
    outstandingTone = "red.6";
  } else if (summary.outstanding < 0) {
    outstandingTone = "teal.6";
  }
  const sharedSpendStatusChips = [
    {
      id: "shared-expenses",
      label: `${filteredSharedExpenses.length} shared`,
      color: "blue",
      tooltip: "Shared expenses that match the current filters.",
    },
    {
      id: "reimbursements",
      label: countLabel,
      color:
        linkedReimbursements.length + legacyReimbursementCount > 0 ? "teal" : "gray",
      tooltip: "Linked and legacy reimbursement transactions recorded so far.",
    },
    {
      id: "outstanding",
      label:
        summary.outstanding === 0
          ? "All settled"
          : `${outstandingLabel} ${formatINR(Math.abs(summary.outstanding))}`,
      color:
        summary.outstanding > 0
          ? "orange"
          : summary.outstanding < 0
            ? "teal"
            : "gray",
      tooltip: "Net amount still owed or overpaid across shared expenses.",
    },
  ];

  const formKey = `${selectedTransaction?.id ?? "new"}-${isFormOpen ? "open" : "closed"}`;

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
            placeholder="e.g., Trip refunds, Card splits"
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

      <TransactionFormModal
        key={formKey}
        opened={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTransactionId(null);
        }}
        transaction={selectedTransaction}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
      />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Shared spend</Title>
            <Text size="sm" c="dimmed">
              Track reimbursements and net shared costs.
            </Text>
            <PageStatusChips items={sharedSpendStatusChips} />
            <Text size="xs" c="dimmed">
              Mark shared expenses (optional tags like \"Trip Goa\") to track net owed or received.
            </Text>
          </Stack>
          <Group gap="sm" align="center" wrap="wrap">
            <TransactionsViewToggle value="shared" />
          </Group>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Expected reimbursements
          </Text>
          <Title order={3} mt="xs">
            {formatINR(summary.expected)}
          </Title>
          <Text size="sm" c="dimmed">
            {filteredSharedExpenses.length} shared expenses
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Received so far
          </Text>
          <Title order={3} mt="xs">
            {formatINR(summary.received)}
          </Title>
          <Text size="sm" c="dimmed">
            {countLabel}
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            {outstandingLabel}
          </Text>
          <Title order={3} mt="xs">
            {formatINR(Math.abs(summary.outstanding))}
          </Title>
          <Text size="sm" c={outstandingTone} fw={600}>
            {summary.outstanding === 0 ? "All settled" : outstandingLabel}
          </Text>
          <Text size="xs" c="dimmed">
            Your share: {formatINR(summary.yourShare)}
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="lg" p="md" className="page-filter-panel">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text fw={600}>Filters</Text>
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="xs" c="dimmed">
                Group by
              </Text>
              <SegmentedControl
                size="xs"
                value={effectiveGroupBy}
                onChange={(value) => setGroupBy(value as "tag" | "category")}
                data={[
                  {
                    value: "tag",
                    label: (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Tag size={14} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Tag</span>
                      </span>
                    ),
                  },
                  {
                    value: "category",
                    label: (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Layers size={14} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          Category
                        </span>
                      </span>
                    ),
                  },
                ]}
              />
            </Group>
          </Group>
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
              placeholder="Counterparty, category, account, tags, notes"
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
              cols={{ base: 1, sm: 2, md: 3, xl: 6 }}
              spacing="sm"
              className="page-filter-advanced"
            >
              <Select
                label="Account"
                data={accounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
                value={filterAccount || null}
                onChange={(value) => setFilterAccount(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Select
                label="Category"
                data={[
                  { value: "uncategorized", label: "Uncategorized" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
                value={filterCategory || null}
                onChange={(value) => setFilterCategory(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Select
                label="Payment"
                data={[
                  { value: "none", label: "No payment method" },
                  ...paymentMethods.map((payment) => ({
                    value: payment.id,
                    label: payment.name,
                  })),
                ]}
                value={filterPayment || null}
                onChange={(value) => setFilterPayment(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <MultiSelect
                label="Tags"
                data={tags.map((tag) => ({ value: tag.name, label: tag.name }))}
                value={filterTags}
                onChange={setFilterTags}
                clearable
                searchable
                size="xs"
                placeholder="Any tags"
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

      {legacySharedTransactions.length > 0 ? (
        <Paper withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Stack gap={2}>
                <Title order={5}>Split details needed</Title>
                <Text size="sm" c="dimmed">
                  {legacySharedTransactions.length} shared expenses are missing split
                  participants.
                </Text>
              </Stack>
            </Group>
            <Stack gap="xs">
              {legacySharedTransactions.map((tx) => {
                const displayCategoryId = getDisplayCategoryId(tx);
                const categoryLabel = displayCategoryId
                  ? categoryMap.get(displayCategoryId) ?? displayCategoryId
                  : "Uncategorized";
                const accountLabel = tx.account_id
                  ? accountMap.get(tx.account_id) ?? "-"
                  : "-";
                return (
                  <Paper
                    key={tx.id}
                    withBorder
                    radius="md"
                    p="sm"
                    style={{ background: "var(--surface-alt)" }}
                  >
                    <Group justify="space-between" align="center" wrap="wrap">
                      <Stack gap={4}>
                        <Text fw={600}>{categoryLabel}</Text>
                        <Text size="xs" c="dimmed">
                          {dayjs(tx.date).format("DD MMM")} · {accountLabel}
                        </Text>
                      </Stack>
                      <Group gap="sm" align="center">
                        <Text fw={600}>{formatINR(tx.amount)}</Text>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            setEditingTransactionId(tx.id);
                            setIsFormOpen(true);
                          }}
                        >
                          Add split
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Paper withBorder radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={5}>Split breakdowns</Title>
            <Text size="sm" c="dimmed">
              Track who owes what across shared expenses.
            </Text>
          </Stack>
        </Group>
        {sharedBreakdowns.length === 0 ? (
          <Text size="sm" c="dimmed">
            No shared splits to show yet.
          </Text>
        ) : (
          <Stack gap="sm">
            {sharedBreakdowns.map((item) => {
              const tx = item.shared.transaction;
              const displayCategoryId = getDisplayCategoryId(tx);
              const categoryLabel = displayCategoryId
                ? categoryMap.get(displayCategoryId) ?? displayCategoryId
                : "Uncategorized";
              const accountLabel = tx.account_id
                ? accountMap.get(tx.account_id) ?? "-"
                : "-";
              const outstandingColor = item.remaining > 0 ? "orange" : "teal";
              const outstandingLabel =
                item.remaining > 0
                  ? `Outstanding ${formatINR(item.remaining)}`
                  : `Overpaid ${formatINR(Math.abs(item.remaining))}`;

              return (
                <Paper
                  key={item.shared.id}
                  withBorder
                  radius="md"
                  p="sm"
                  style={{ background: "var(--surface-alt)" }}
                >
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={2}>
                      <Text fw={600}>{categoryLabel}</Text>
                      <Text size="xs" c="dimmed">
                        {dayjs(tx.date).format("DD MMM")} · {accountLabel}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Total {formatINR(tx.amount)} · Your share{" "}
                        {formatINR(item.yourShare)}
                      </Text>
                    </Stack>
                    <Stack gap={4} align="flex-end">
                      <Badge variant="light" color={outstandingColor} radius="sm">
                        {outstandingLabel}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        Expected {formatINR(item.expected)} · Received{" "}
                        {formatINR(item.received)}
                      </Text>
                    </Stack>
                  </Group>
                  <Stack gap="xs" mt="sm">
                    {item.participants.length === 0 ? (
                      <Text size="xs" c="dimmed">
                        Add participants to track per-person shares.
                      </Text>
                    ) : (
                      item.participants.map((participant) => (
                        <Group
                          key={participant.id}
                          justify="space-between"
                          align="center"
                          wrap="wrap"
                        >
                          <Text size="sm">{participant.name}</Text>
                          <Group gap="xs" align="center">
                            <Badge variant="light" color="blue" radius="sm">
                              Share {formatINR(participant.share_amount)}
                            </Badge>
                            <Badge variant="light" color="teal" radius="sm">
                              Received {formatINR(participant.received)}
                            </Badge>
                            <Badge
                              variant="light"
                              color={participant.remaining > 0 ? "orange" : "teal"}
                              radius="sm"
                            >
                              Remaining {formatINR(Math.abs(participant.remaining))}
                            </Badge>
                          </Group>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Paper withBorder radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={5}>Net by {effectiveGroupBy === "tag" ? "tag" : "category"}</Title>
            <Text size="sm" c="dimmed">
              {effectiveGroupBy === "tag"
                ? "Use tags to group shared splits. Untagged items roll up under Unassigned."
                : "Shared splits appear by category, reimbursements offset them."}
            </Text>
          </Stack>
        </Group>
        <DatatrixTable
          rows={netRows}
          columns={netColumns}
          emptyLabel={
            effectiveGroupBy === "tag"
              ? "Add shared split details to see grouped totals."
              : "No shared splits yet for this month."
          }
          loading={isSharedLoadingState}
          height={isMobile ? undefined : "max(320px, calc(100vh - 520px))"}
          getRowId={(row) => row.id}
        />
      </Paper>

      <Paper withBorder radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={5}>Reimbursements</Title>
            <Text size="sm" c="dimmed">
              {countLabel}
            </Text>
            <Text size="xs" c="dimmed">
              Click a row to edit a reimbursement entry.
            </Text>
          </Stack>
        </Group>
        <DatatrixTable
          rows={reimbursementRows}
          columns={reimbursementColumns}
          emptyLabel="No reimbursements yet. Mark income as reimbursement and link it to a shared expense."
          loading={isSharedLoadingState}
          height="max(360px, calc(100vh - 420px))"
          getRowId={(row) => row.id}
          onRowClick={(row) => {
            setEditingTransactionId(row.id);
            setIsFormOpen(true);
          }}
        />
      </Paper>
    </Stack>
  );
};
