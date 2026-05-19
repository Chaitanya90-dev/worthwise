import {
  Badge,
  Button,
  Collapse,
  Group,
  MultiSelect,
  Modal,
  Paper,
  Popover,
  SimpleGrid,
  Switch,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTagsQuery,
  useGetTransactionsQuery,
  useUpdateTransactionMutation,
} from "../features/api/apiSlice";
import { formatINR } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { PageActionMenu } from "../components/common/PageActionMenu";
import { PageStatusChips } from "../components/common/PageStatusChips";
import { TransactionFormModal } from "../components/transactions/TransactionFormModal";
import { TransactionImportModal } from "../components/transactions/TransactionImportModal";
import { TransactionsViewToggle } from "../components/transactions/TransactionsViewToggle";
import { TransferDetailDrawer } from "../components/transactions/TransferDetailDrawer";
import { BulkEntryModal } from "../components/transactions/BulkEntryModal";
import { useSearchParams } from "react-router-dom";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import type { Transaction } from "../types/finance";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import { useAppSelector } from "../app/hooks";
import { useAppMonth } from "../context/AppMonthContext";
import { useReadOnly } from "../context/ReadOnlyContext";
import { buildDisplayTransactions, type DisplayTransaction } from "../lib/displayTransactions";
import {
  areTransactionFiltersEqual,
  createEmptyTransactionFilters,
  filterTransactions,
  normalizeTransactionFilters,
  type TransactionFilterState,
} from "../lib/transactionFilters";

type TransactionRow = {
  id: string;
  date: string;
  category: string;
  merchant: string;
  account: string;
  payment: string;
  notes: string;
  tags: string;
  amount: number;
  currency: string | null;
  type: Transaction["type"];
  isTransfer: boolean;
  isReimbursement: boolean;
  isShared: boolean;
  transferGroupId?: string | null;
};

const TransactionTypeCell = (params: ICellRendererParams<TransactionRow>) => {
  const isTransfer = params.data?.isTransfer;
  const isReimbursement = params.data?.isReimbursement;
  const isShared = params.data?.isShared;
  const type = params.data?.type ?? "expense";
  if (isTransfer) {
    return (
      <Tooltip
        label="Internal move, excluded from budgets and income."
        withArrow
      >
        <Badge variant="light" color="gray" radius="sm">
          Transfer
        </Badge>
      </Tooltip>
    );
  }
  if (isReimbursement) {
    return (
      <Tooltip label="Income that offsets a previous expense." withArrow>
        <Badge variant="light" color="blue" radius="sm">
          Reimbursement
        </Badge>
      </Tooltip>
    );
  }
  return (
    <Group gap={6} wrap="wrap">
      <Badge
        variant="light"
        color={type === "income" ? "teal" : "red"}
        radius="sm"
      >
        {type === "income" ? "Income" : "Expense"}
      </Badge>
      {isShared && type === "expense" ? (
        <Tooltip label="Group expense with a split." withArrow>
          <Badge variant="light" color="orange" radius="sm">
            Shared
          </Badge>
        </Tooltip>
      ) : null}
    </Group>
  );
};

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:transactions:${userId ?? "anon"}`;

export const Transactions = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { month } = useAppMonth();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<
    TransactionFilterState["type"]
  >("");
  const [filterFlags, setFilterFlags] = useState<string[]>([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<TransactionFilterState>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));
  const [selectedRows, setSelectedRows] = useState<TransactionRow[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategoryEnabled, setBulkCategoryEnabled] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);
  const [bulkAccountEnabled, setBulkAccountEnabled] = useState(false);
  const [bulkAccountId, setBulkAccountId] = useState<string | null>(null);
  const [bulkTagsEnabled, setBulkTagsEnabled] = useState(false);
  const [bulkTags, setBulkTags] = useState("");
  const [bulkTransferEnabled, setBulkTransferEnabled] = useState(false);
  const [bulkTransferValue, setBulkTransferValue] = useState<"on" | "off">("on");
  const [bulkReimbursementEnabled, setBulkReimbursementEnabled] = useState(false);
  const [bulkReimbursementValue, setBulkReimbursementValue] = useState<"on" | "off">(
    "on"
  );
  const [bulkSharedEnabled, setBulkSharedEnabled] = useState(false);
  const [bulkSharedValue, setBulkSharedValue] = useState<"on" | "off">("on");
  const [bulkRecurringEnabled, setBulkRecurringEnabled] = useState(false);
  const [bulkRecurringValue, setBulkRecurringValue] = useState<"on" | "off">("on");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const gridApiRef = useRef<GridApi<TransactionRow> | null>(null);
  const [transferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [transferGroupId, setTransferGroupId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get("action");
  const formVisible = isFormOpen || actionParam === "new";
  const importVisible = isImportOpen || actionParam === "import";

  useEffect(() => {
    const hasSearchPreset = [
      "q",
      "account",
      "category",
      "payment",
      "tag",
      "tags",
      "type",
      "flags",
      "from",
      "to",
      "min",
      "max",
    ].some((key) => searchParams.has(key));

    if (!hasSearchPreset) {
      return;
    }

    setSearch(searchParams.get("q") ?? "");
    setFilterAccount(searchParams.get("account") ?? "");
    setFilterCategory(searchParams.get("category") ?? "");
    setFilterPayment(searchParams.get("payment") ?? "");
    setFilterTags(
      normalizeTransactionFilters({
        tags: searchParams.get("tags")?.split(",") ?? undefined,
        tag: searchParams.get("tag") ?? undefined,
      }).tags
    );
    setFilterType(
      normalizeTransactionFilters({
        type: searchParams.get("type") ?? undefined,
      }).type
    );
    setFilterFlags(
      normalizeTransactionFilters({
        flags: searchParams.get("flags")?.split(",") ?? undefined,
      }).flags
    );
    setFilterFrom(searchParams.get("from") ?? "");
    setFilterTo(searchParams.get("to") ?? "");
    setMinAmount(searchParams.get("min") ?? "");
    setMaxAmount(searchParams.get("max") ?? "");
  }, [searchParams]);


  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: tags = [] } = useGetTagsQuery();
  const { data: transactions = [], isLoading: isTransactionsLoading } =
    useGetTransactionsQuery({ month });
  const [updateTransaction] = useUpdateTransactionMutation();
  const isReadOnly = useReadOnly();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((pm) => [pm.id, pm.name])),
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
  const displayTransactions = useMemo<DisplayTransaction[]>(() => {
    return buildDisplayTransactions({
      transactions,
      categoryMap,
      accountMap,
      accountCurrencyMap,
      paymentMap,
    });
  }, [transactions, categoryMap, accountMap, accountCurrencyMap, paymentMap]);

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
  const filteredTransactions = useMemo(() => {
    return filterTransactions(displayTransactions, currentFilters);
  }, [displayTransactions, currentFilters]);

  const rows = useMemo<TransactionRow[]>(
    () =>
      filteredTransactions.map((tx) => ({
        id: tx.rowId,
        date: dayjs(tx.date).format("DD MMM"),
        category: tx.displayCategory,
        merchant: tx.displayMerchant,
        account: tx.displayAccount,
        payment: tx.displayPayment,
        notes: tx.displayNotes,
        tags: tx.displayTags,
        amount: tx.amount,
        currency: tx.currency ?? null,
        type: tx.type,
        isTransfer: Boolean(tx.is_transfer),
        isReimbursement: Boolean(tx.is_reimbursement),
        isShared: Boolean(tx.is_shared),
        transferGroupId: tx.isGroupedTransfer ? tx.transfer_group_id : null,
      })),
    [filteredTransactions]
  );
  const transactionMap = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, tx])),
    [transactions]
  );
  const columns = useMemo<ColDef<TransactionRow>[]>(
    () => [
      {
        headerName: "",
        colId: "select",
        width: 48,
        checkboxSelection: (params) => !params.data?.transferGroupId,
        headerCheckboxSelection: true,
        sortable: false,
        resizable: false,
        pinned: "left",
      },
      { headerName: "Date", field: "date", maxWidth: 120 },
      {
        headerName: "Category",
        field: "category",
        flex: 1.2,
      },
      {
        headerName: "Counterparty",
        field: "merchant",
        flex: 1.2,
        cellClass: "datatrix-cell-muted",
        valueFormatter: (params) => (params.value ? params.value : "-"),
      },
      {
        headerName: "Type",
        field: "type",
        maxWidth: 140,
        cellRenderer: TransactionTypeCell,
      },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Notes",
        field: "notes",
        flex: 1.6,
        cellClass: "datatrix-cell-muted",
        valueFormatter: (params) => (params.value ? params.value : "-"),
      },
      {
        headerName: "Tags",
        field: "tags",
        flex: 1.2,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 160,
        valueFormatter: (params) => {
          const raw = Number(params.value ?? 0);
          if (params.data?.isTransfer) {
            return formatINR(raw, params.data?.currency);
          }
          const sign = params.data?.type === "expense" ? "-" : "+";
          return `${sign}${formatINR(raw, params.data?.currency)}`;
        },
        cellClass: (params) =>
          params.data?.isTransfer
            ? "datatrix-cell-muted"
            : params.data?.type === "expense"
            ? "datatrix-cell-negative"
            : "datatrix-cell-positive",
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

  const clearActionParam = () => {
    if (!actionParam) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  const handleOpenCreate = () => {
    setEditingTransactionId(null);
    setIsFormOpen(true);
  };

  const handleEditTransaction = (id: string) => {
    setEditingTransactionId(id);
    setIsFormOpen(true);
  };

  const handleOpenTransfer = (groupId: string) => {
    setTransferGroupId(groupId);
    setTransferDrawerOpen(true);
  };

  const handleCloseTransfer = () => {
    setTransferDrawerOpen(false);
    setTransferGroupId(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransactionId(null);
    clearActionParam();
  };

  const handleCloseImport = () => {
    setIsImportOpen(false);
    clearActionParam();
  };

  const formKey = `${selectedTransaction?.id ?? "new"}-${
    formVisible ? "open" : "closed"
  }`;
  const importKey = `import-${importVisible ? "open" : "closed"}`;
  const totalCount = displayTransactions.length;
  const filteredCount = filteredTransactions.length;
  const hasActiveFilters = useMemo(
    () =>
      !areTransactionFiltersEqual(
        currentFilters,
        createEmptyTransactionFilters()
      ),
    [currentFilters]
  );
  const countLabel =
    totalCount === filteredCount
      ? `${totalCount} items`
      : `${filteredCount} of ${totalCount} items`;
  const recurringCount = useMemo(
    () =>
      filteredTransactions.filter(
        (tx) => tx.is_recurring && !tx.isGroupedTransfer && !tx.is_reimbursement
      ).length,
    [filteredTransactions]
  );
  const sharedCount = useMemo(
    () => filteredTransactions.filter((tx) => tx.is_shared).length,
    [filteredTransactions]
  );
  const transferCount = useMemo(
    () => filteredTransactions.filter((tx) => tx.isGroupedTransfer).length,
    [filteredTransactions]
  );
  const transactionStatusChips = useMemo(
    () => [
      {
        id: "visible",
        label: `${filteredCount} visible`,
        color: "blue",
        tooltip:
          filteredCount === totalCount
            ? "All transactions are visible."
            : `${totalCount} total transactions in this month.`,
      },
      {
        id: "recurring",
        label: `${recurringCount} recurring`,
        color: recurringCount > 0 ? "grape" : "gray",
        tooltip: "Recurring transactions in the current result set.",
      },
      {
        id: "shared",
        label: `${sharedCount} shared`,
        color: sharedCount > 0 ? "orange" : "gray",
        tooltip: "Shared expenses in the current result set.",
      },
      {
        id: "transfers",
        label: `${transferCount} transfers`,
        color: transferCount > 0 ? "gray" : "gray",
        tooltip: "Internal account-to-account moves in the current result set.",
      },
    ],
    [filteredCount, totalCount, recurringCount, sharedCount, transferCount]
  );
  const transactionOverflowActions = isMobile
    ? [
        {
          label: "Add transaction",
          icon: <Plus size={16} strokeWidth={2} />,
          onClick: handleOpenCreate,
          disabled: isReadOnly,
        },
        {
          label: "Import CSV",
          icon: <Upload size={16} strokeWidth={2} />,
          onClick: () => setIsImportOpen(true),
          disabled: isReadOnly,
        },
        {
          label: "Bulk entry",
          icon: <Plus size={16} strokeWidth={2} />,
          onClick: () => setIsBulkEntryOpen(true),
          disabled: isReadOnly,
        },
      ]
    : [
        {
          label: "Import CSV",
          icon: <Upload size={16} strokeWidth={2} />,
          onClick: () => setIsImportOpen(true),
          disabled: isReadOnly,
        },
        {
          label: "Bulk entry",
          icon: <Plus size={16} strokeWidth={2} />,
          onClick: () => setIsBulkEntryOpen(true),
          disabled: isReadOnly,
        },
      ];

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
  const tagOptions = useMemo(
    () => tags.map((tag) => ({ value: tag.name, label: tag.name })),
    [tags]
  );
  const flagOptions = useMemo(
    () => [
      { value: "recurring", label: "Recurring" },
      { value: "shared", label: "Shared" },
      { value: "reimbursement", label: "Reimbursement" },
      { value: "uncategorized", label: "Uncategorized" },
      { value: "untagged", label: "Untagged" },
      { value: "has-notes", label: "Has notes" },
    ],
    []
  );
  const summarizeValues = (values: string[]) => {
    if (values.length <= 2) {
      return values.join(", ");
    }
    return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
  };

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
    if (filterType) {
      chips.push({
        key: "type",
        label: `Type: ${
          filterType === "transfer"
            ? "Transfer"
            : filterType === "income"
            ? "Income"
            : "Expense"
        }`,
        onClear: () => setFilterType(""),
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
        label: `Flags: ${summarizeValues(
          filterFlags.map(
            (flag) => flagOptions.find((option) => option.value === flag)?.label ?? flag
          )
        )}`,
        onClear: () => setFilterFlags([]),
      });
    }
    if (filterFrom || filterTo) {
      const normalizedFrom =
        filterFrom && filterTo && filterFrom > filterTo ? filterTo : filterFrom;
      const normalizedTo =
        filterFrom && filterTo && filterFrom > filterTo ? filterFrom : filterTo;
      const fromLabel = normalizedFrom
        ? dayjs(normalizedFrom).format("DD MMM")
        : "Any";
      const toLabel = normalizedTo ? dayjs(normalizedTo).format("DD MMM") : "Any";
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
      const parsedMin = minAmount ? Number(minAmount) : null;
      const parsedMax = maxAmount ? Number(maxAmount) : null;
      const normalizedMin =
        parsedMin !== null && parsedMax !== null && parsedMin > parsedMax
          ? parsedMax
          : parsedMin;
      const normalizedMax =
        parsedMin !== null && parsedMax !== null && parsedMin > parsedMax
          ? parsedMin
          : parsedMax;
      const minLabel =
        normalizedMin !== null && Number.isFinite(normalizedMin)
          ? formatINR(normalizedMin)
          : "Any";
      const maxLabel =
        normalizedMax !== null && Number.isFinite(normalizedMax)
          ? formatINR(normalizedMax)
          : "Any";
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
    filterAccount,
    filterCategory,
    filterPayment,
    filterType,
    filterTags,
    filterFlags,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    accountMap,
    categoryMap,
    paymentMap,
    flagOptions,
  ]);
  const advancedFilterCount = useMemo(
    () => activeChips.filter((chip) => chip.key !== "search").length,
    [activeChips]
  );
  const visibleFilterChips = useMemo(
    () =>
      filtersExpanded
        ? activeChips
        : activeChips.filter((chip) => chip.key !== "search"),
    [activeChips, filtersExpanded]
  );

  const bulkCategoryOptions = useMemo(
    () => [
      { value: "uncategorized", label: "Uncategorized" },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories]
  );
  const bulkAccountOptions = useMemo(
    () => [
      { value: "none", label: "No account" },
      ...accounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    ],
    [accounts]
  );

  const selectedIds = useMemo(
    () => selectedRows.map((row) => row.id),
    [selectedRows]
  );

  const handleOpenBulk = () => {
    if (selectedIds.length === 0) {
      return;
    }
    setBulkError(null);
    setBulkCategoryEnabled(false);
    setBulkCategoryId(null);
    setBulkAccountEnabled(false);
    setBulkAccountId(null);
    setBulkTagsEnabled(false);
    setBulkTags("");
    setBulkTransferEnabled(false);
    setBulkTransferValue("on");
    setBulkReimbursementEnabled(false);
    setBulkReimbursementValue("on");
    setBulkSharedEnabled(false);
    setBulkSharedValue("on");
    setBulkRecurringEnabled(false);
    setBulkRecurringValue("on");
    setBulkOpen(true);
  };

  const handleCloseBulk = () => {
    setBulkOpen(false);
    setBulkError(null);
  };

  const handleClearSelection = () => {
    gridApiRef.current?.deselectAll();
    setSelectedRows([]);
  };

  const handleApplyBulk = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const hasFlagUpdates =
      bulkTransferEnabled ||
      bulkReimbursementEnabled ||
      bulkSharedEnabled ||
      bulkRecurringEnabled;
    if (!bulkCategoryEnabled && !bulkAccountEnabled && !bulkTagsEnabled && !hasFlagUpdates) {
      setBulkError("Select at least one field to update.");
      return;
    }
    setBulkSaving(true);
    setBulkError(null);
    const nextTags = bulkTagsEnabled
      ? bulkTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    try {
      for (const id of selectedIds) {
        const transaction = transactionMap.get(id);
        if (!transaction) continue;
        const nextCategoryId = bulkCategoryEnabled
          ? bulkCategoryId === "uncategorized"
            ? null
            : bulkCategoryId
          : transaction.category_id ?? null;
        const nextAccountId = bulkAccountEnabled
          ? bulkAccountId === "none"
            ? null
            : bulkAccountId
          : transaction.account_id ?? null;
        const nextTransfer = bulkTransferEnabled
          ? bulkTransferValue === "on"
          : transaction.is_transfer ?? false;
        const nextRecurring = bulkRecurringEnabled
          ? bulkRecurringValue === "on"
          : transaction.is_recurring;
        let nextReimbursement = bulkReimbursementEnabled
          ? bulkReimbursementValue === "on"
          : transaction.is_reimbursement ?? false;
        let nextShared = bulkSharedEnabled
          ? bulkSharedValue === "on"
          : transaction.is_shared ?? false;

        if (nextTransfer) {
          nextReimbursement = false;
          nextShared = false;
        }
        if (transaction.type !== "income") {
          nextReimbursement = false;
        }
        if (transaction.type !== "expense") {
          nextShared = false;
        }

        const shouldUpdateReimbursement = bulkReimbursementEnabled || bulkTransferEnabled;
        const reimbursementCategoryId = shouldUpdateReimbursement
          ? nextReimbursement
            ? transaction.reimbursement_category_id ?? null
            : null
          : transaction.reimbursement_category_id ?? null;
        const nextTagsFinal = bulkTagsEnabled
          ? nextTags
          : transaction.tags?.map((tag) => tag.name) ?? [];

        const payload = {
          id: transaction.id,
          type: transaction.type,
          date: transaction.date,
          amount: transaction.amount,
          category_id: nextCategoryId,
          reimbursement_category_id: reimbursementCategoryId,
          payment_method_id: transaction.payment_method_id ?? null,
          account_id: nextAccountId,
          notes: transaction.notes ?? null,
          tags: nextTagsFinal,
          is_transfer: nextTransfer,
          is_recurring: nextRecurring,
          is_reimbursement: nextReimbursement,
          is_shared: nextShared,
        };

        const payloadWithReimbursement =
          shouldUpdateReimbursement && !nextReimbursement
            ? { ...payload, sharedReimbursement: null }
            : payload;

        await updateTransaction(payloadWithReimbursement).unwrap();
      }
      setBulkOpen(false);
      handleClearSelection();
    } catch {
      setBulkError("Unable to apply bulk changes. Try again.");
    } finally {
      setBulkSaving(false);
    }
  };

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
    setFilterType(next.type);
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
    const value: TransactionFilterState = currentFilters;
    persistSavedFilters([...savedFilters, { id, name: trimmed, value }]);
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
    setFilterType(next.type);
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
            placeholder="e.g., Card spend, Food only"
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
      <Modal
        opened={bulkOpen}
        onClose={handleCloseBulk}
        title={`Bulk edit (${selectedIds.length})`}
        size="md"
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Apply changes to all selected transactions.
            </Text>
            <Button variant="subtle" color="gray" size="xs" onClick={handleClearSelection}>
              Clear selection
            </Button>
          </Group>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Category
              </Text>
              <Switch
                checked={bulkCategoryEnabled}
                onChange={(event) =>
                  setBulkCategoryEnabled(event.currentTarget.checked)
                }
                size="sm"
                label={bulkCategoryEnabled ? "Enabled" : "Skip"}
              />
            </Group>
            <Select
              data={bulkCategoryOptions}
              value={bulkCategoryId}
              onChange={setBulkCategoryId}
              disabled={!bulkCategoryEnabled}
              placeholder="Choose category"
              searchable
              clearable
            />
          </Stack>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Account
              </Text>
              <Switch
                checked={bulkAccountEnabled}
                onChange={(event) =>
                  setBulkAccountEnabled(event.currentTarget.checked)
                }
                size="sm"
                label={bulkAccountEnabled ? "Enabled" : "Skip"}
              />
            </Group>
            <Select
              data={bulkAccountOptions}
              value={bulkAccountId}
              onChange={setBulkAccountId}
              disabled={!bulkAccountEnabled}
              placeholder="Choose account"
              searchable
              clearable
            />
          </Stack>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Tags
              </Text>
              <Switch
                checked={bulkTagsEnabled}
                onChange={(event) =>
                  setBulkTagsEnabled(event.currentTarget.checked)
                }
                size="sm"
                label={bulkTagsEnabled ? "Enabled" : "Skip"}
              />
            </Group>
            <TextInput
              value={bulkTags}
              onChange={(event) => setBulkTags(event.target.value)}
              disabled={!bulkTagsEnabled}
              placeholder="comma separated"
            />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Flags
            </Text>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Transfer
                </Text>
                <Switch
                  checked={bulkTransferEnabled}
                  onChange={(event) =>
                    setBulkTransferEnabled(event.currentTarget.checked)
                  }
                  size="sm"
                  label={bulkTransferEnabled ? "Enabled" : "Skip"}
                />
              </Group>
              <SegmentedControl
                data={[
                  { label: "On", value: "on" },
                  { label: "Off", value: "off" },
                ]}
                value={bulkTransferValue}
                onChange={(value) => setBulkTransferValue(value as "on" | "off")}
                disabled={!bulkTransferEnabled}
                size="xs"
                fullWidth
              />
              <Text size="xs" c="dimmed">
                Transfers are excluded from budgets and income totals.
              </Text>
            </Stack>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Reimbursement
                </Text>
                <Switch
                  checked={bulkReimbursementEnabled}
                  onChange={(event) =>
                    setBulkReimbursementEnabled(event.currentTarget.checked)
                  }
                  size="sm"
                  label={bulkReimbursementEnabled ? "Enabled" : "Skip"}
                />
              </Group>
              <SegmentedControl
                data={[
                  { label: "On", value: "on" },
                  { label: "Off", value: "off" },
                ]}
                value={bulkReimbursementValue}
                onChange={(value) =>
                  setBulkReimbursementValue(value as "on" | "off")
                }
                disabled={!bulkReimbursementEnabled}
                size="xs"
                fullWidth
              />
              <Text size="xs" c="dimmed">
                Applies to income only. Link to shared spend in the full edit if needed.
              </Text>
            </Stack>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Shared
                </Text>
                <Switch
                  checked={bulkSharedEnabled}
                  onChange={(event) =>
                    setBulkSharedEnabled(event.currentTarget.checked)
                  }
                  size="sm"
                  label={bulkSharedEnabled ? "Enabled" : "Skip"}
                />
              </Group>
              <SegmentedControl
                data={[
                  { label: "On", value: "on" },
                  { label: "Off", value: "off" },
                ]}
                value={bulkSharedValue}
                onChange={(value) => setBulkSharedValue(value as "on" | "off")}
                disabled={!bulkSharedEnabled}
                size="xs"
                fullWidth
              />
              <Text size="xs" c="dimmed">
                Applies to expenses. Add split details in the full edit if needed.
              </Text>
            </Stack>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Recurring
                </Text>
                <Switch
                  checked={bulkRecurringEnabled}
                  onChange={(event) =>
                    setBulkRecurringEnabled(event.currentTarget.checked)
                  }
                  size="sm"
                  label={bulkRecurringEnabled ? "Enabled" : "Skip"}
                />
              </Group>
              <SegmentedControl
                data={[
                  { label: "On", value: "on" },
                  { label: "Off", value: "off" },
                ]}
                value={bulkRecurringValue}
                onChange={(value) => setBulkRecurringValue(value as "on" | "off")}
                disabled={!bulkRecurringEnabled}
                size="xs"
                fullWidth
              />
              <Text size="xs" c="dimmed">
                Marks the transaction as repeating monthly.
              </Text>
            </Stack>
          </Stack>
          {bulkError ? (
            <Text size="sm" c="red">
              {bulkError}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={handleCloseBulk}>
              Cancel
            </Button>
            <Button
              color="green"
              loading={bulkSaving}
              onClick={handleApplyBulk}
              disabled={isReadOnly}
            >
              Apply changes
            </Button>
          </Group>
        </Stack>
      </Modal>
      <TransactionFormModal
        key={formKey}
        opened={formVisible}
        onClose={handleCloseForm}
        transaction={selectedTransaction}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
        readOnly={isReadOnly}
      />
      <TransactionImportModal
        key={importKey}
        opened={importVisible}
        onClose={handleCloseImport}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
      />
      <BulkEntryModal
        opened={isBulkEntryOpen}
        onClose={() => setIsBulkEntryOpen(false)}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
        readOnly={isReadOnly}
      />
      <TransferDetailDrawer
        opened={transferDrawerOpen}
        onClose={handleCloseTransfer}
        transferGroupId={transferGroupId}
        transactions={transactions}
        accounts={accounts}
      />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Transactions</Title>
            <Text size="sm" c="dimmed">
              {countLabel}
            </Text>
            <PageStatusChips items={transactionStatusChips} />
            <Text size="xs" c="dimmed">
              Click a row to edit or delete. Transfers are managed in Accounts.
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TransactionsViewToggle value="transactions" />
            <PageActionMenu items={transactionOverflowActions} />
            {isMobile ? null : (
              <Button
                leftSection={<Plus size={16} strokeWidth={2} />}
                onClick={handleOpenCreate}
                disabled={isReadOnly}
              >
                Add transaction
              </Button>
            )}
          </Group>
        </Group>
        {selectedIds.length > 0 ? (
          <Paper withBorder radius="md" p="sm" mb="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm">
                {selectedIds.length} selected
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleOpenBulk}
                  disabled={isReadOnly}
                >
                  Bulk edit
                </Button>
                <Button size="xs" variant="subtle" color="gray" onClick={handleClearSelection}>
                  Clear
                </Button>
              </Group>
            </Group>
          </Paper>
        ) : null}
        <Stack gap="xs" mb="md">
          <Paper withBorder radius="md" p="sm" className="page-filter-panel">
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
                  placeholder="Counterparty, note, tag, amount, or date"
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
                          placeholder="Choose a saved view"
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
                  cols={{ base: 1, sm: 2, lg: 4, xl: 5 }}
                  spacing="sm"
                  className="page-filter-advanced"
                >
                  <Select
                    label="Type"
                    data={[
                      { value: "expense", label: "Expense" },
                      { value: "income", label: "Income" },
                      { value: "transfer", label: "Transfer" },
                    ]}
                    value={filterType || null}
                    onChange={(value) =>
                      setFilterType((value as TransactionFilterState["type"] | null) ?? "")
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
                    data={tagOptions}
                    value={filterTags}
                    onChange={setFilterTags}
                    searchable
                    clearable
                    hidePickedOptions
                    size="xs"
                    placeholder="Any tags"
                  />
                  <MultiSelect
                    label="Flags"
                    data={flagOptions}
                    value={filterFlags}
                    onChange={setFilterFlags}
                    searchable
                    clearable
                    hidePickedOptions
                    size="xs"
                    placeholder="Any flags"
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
        </Stack>
        <DatatrixTable
          rows={rows}
          columns={columns}
          height="max(420px, calc(100vh - 280px))"
          emptyLabel="No transactions yet. Add or import to get started."
          loading={isTransactionsLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => {
            if (row.transferGroupId) {
              handleOpenTransfer(row.transferGroupId);
              return;
            }
            handleEditTransaction(row.id);
          }}
          enableSelection
          onSelectionChanged={(rows) => setSelectedRows(rows)}
          onGridReady={(event) => {
            gridApiRef.current = event.api;
          }}
        />
      </Paper>
    </Stack>
  );
};
