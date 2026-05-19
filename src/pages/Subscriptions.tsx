import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  Menu,
  Modal,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  CircleDollarSign,
} from "lucide-react";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAddTransactionMutation,
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetSubscriptionsQuery,
  useUpdateSubscriptionMutation,
} from "../features/api/apiSlice";
import { DatatrixTable } from "../components/DatatrixTable";
import { PageStatusChips } from "../components/common/PageStatusChips";
import { SubscriptionFormModal } from "../components/subscriptions/SubscriptionFormModal";
import { formatINR } from "../lib/format";
import {
  calculateSubscriptionTotals,
  formatIntervalLabel,
  getSubscriptionAmountSearchTexts,
  getSubscriptionNativeAmountLabel,
  getSubscriptionPlanningAmount,
  getSubscriptionPlanningAmountLabel,
  getUpcomingSubscriptions,
  isForeignCurrencySubscription,
  isSubscriptionOverdue,
} from "../lib/subscriptions";
import { getBaseCurrency } from "../lib/moneyConfig";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { Subscription } from "../types/finance";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import { useAppSelector } from "../app/hooks";
import { useReadOnly } from "../context/ReadOnlyContext";

type SubscriptionRow = {
  id: string;
  name: string;
  cadence: string;
  next_due: string;
  next_due_raw: string;
  amount: number;
  amount_label: string;
  amount_detail: string | null;
  status: Subscription["status"];
  account: string;
  category: string;
  payment: string;
  overdue: boolean;
  hasAccount: boolean;
  requiresManualPost: boolean;
};

type SubscriptionActionParams = {
  onPostPayment: (id: string) => void;
  onSkipNextCycle: (id: string) => void;
  onOpenPauseUntil: (id: string) => void;
  postingId: string | null;
  schedulingId: string | null;
  isBulkPosting: boolean;
  postErrors: Record<string, string>;
  scheduleErrors: Record<string, string>;
  readOnly: boolean;
};

type SubscriptionFilters = {
  search: string;
  status: string;
  accountId: string;
  dueFrom: string;
  dueTo: string;
  minAmount: string;
  maxAmount: string;
};

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:subscriptions:${userId ?? "anon"}`;

const SubscriptionNextDueCell = (
  params: ICellRendererParams<SubscriptionRow>
) => {
  const raw = params.data?.next_due_raw;
  if (!raw) {
    return <Text size="sm">-</Text>;
  }
  const dueDate = dayjs(raw);
  const daysAway = dueDate.diff(dayjs(), "day");
  const isOverdue = daysAway < 0;
  const isToday = daysAway === 0;
  const isSoon = daysAway > 0 && daysAway <= 7;
  let statusLabel = "Upcoming";
  let detailLabel = `In ${daysAway} days`;

  if (isOverdue) {
    statusLabel = "Overdue";
    detailLabel = `${Math.abs(daysAway)} days late`;
  } else if (isToday) {
    statusLabel = "Due today";
    detailLabel = "Today";
  } else if (isSoon) {
    statusLabel = "Due soon";
    detailLabel = `In ${daysAway} days`;
  }

  let tone = "gray";
  if (isOverdue) {
    tone = "red";
  } else if (isSoon || isToday) {
    tone = "orange";
  }
  return (
    <Stack gap={4}>
      <Text fw={600}>{params.data?.next_due}</Text>
      <Group gap={6} wrap="wrap">
        <Badge variant="light" color={tone} radius="sm">
          {statusLabel}
        </Badge>
        <Text size="xs" c="dimmed">
          {detailLabel}
        </Text>
      </Group>
    </Stack>
  );
};

const SubscriptionStatusCell = (
  params: ICellRendererParams<SubscriptionRow>
) => {
  const status = params.data?.status ?? "active";
  let color = "gray";
  let label = "Cancelled";
  if (status === "active") {
    color = "green";
    label = "Active";
  } else if (status === "paused") {
    color = "yellow";
    label = "Paused";
  }
  return (
    <Badge variant="light" color={color} radius="sm">
      {label}
    </Badge>
  );
};

const SubscriptionAmountCell = (
  params: ICellRendererParams<SubscriptionRow>
) => {
  const row = params.data;
  if (!row) {
    return null;
  }
  return (
    <Stack gap={2}>
      <Text fw={600}>{row.amount_label}</Text>
      {row.amount_detail ? (
        <Text size="xs" c="dimmed">
          {row.amount_detail}
        </Text>
      ) : null}
    </Stack>
  );
};

const SubscriptionActionsCell = (
  params: ICellRendererParams<SubscriptionRow> & SubscriptionActionParams
) => {
  const row = params.data;
  if (!row) {
    return null;
  }
  const disabled =
    row.status !== "active" ||
    !row.hasAccount ||
    Boolean(params.postingId) ||
    params.isBulkPosting ||
    params.readOnly;
  const scheduleDisabled =
    row.status !== "active" ||
    !row.next_due_raw ||
    Boolean(params.schedulingId) ||
    params.readOnly;
  const rowError = params.postErrors[row.id];
  const scheduleError = params.scheduleErrors[row.id];
  const menuDisabled = disabled && scheduleDisabled;
  const paymentLabel = row.requiresManualPost ? "Review & post" : "Post payment";
  return (
    <Stack gap={4}>
      <Group gap={6} wrap="nowrap" justify="flex-end">
        <Menu position="bottom-end" withArrow withinPortal>
          <Menu.Target>
            <Button
              size="xs"
              variant="light"
              rightSection={<ChevronDown size={14} strokeWidth={2} />}
              disabled={menuDisabled}
              onClick={(event) => event.stopPropagation()}
            >
              Actions
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<CircleDollarSign size={14} strokeWidth={2} />}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                params.onPostPayment(row.id);
              }}
            >
              {paymentLabel}
            </Menu.Item>
            <Menu.Item
              leftSection={<CheckCircle2 size={14} strokeWidth={2} />}
              disabled={scheduleDisabled}
              onClick={(event) => {
                event.stopPropagation();
                params.onSkipNextCycle(row.id);
              }}
            >
              Skip next cycle
            </Menu.Item>
            <Menu.Item
              leftSection={<MoreHorizontal size={14} strokeWidth={2} />}
              disabled={scheduleDisabled}
              onClick={(event) => {
                event.stopPropagation();
                params.onOpenPauseUntil(row.id);
              }}
            >
              Pause until...
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {rowError ? (
        <Text size="xs" c="red.6">
          {rowError}
        </Text>
      ) : null}
      {scheduleError ? (
        <Text size="xs" c="red.6">
          {scheduleError}
        </Text>
      ) : null}
    </Stack>
  );
};

export const Subscriptions = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const isReadOnly = useReadOnly();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const [postModalSubscriptionId, setPostModalSubscriptionId] = useState<string | null>(
    null
  );
  const [postModalAmount, setPostModalAmount] = useState("");
  const [postModalError, setPostModalError] = useState<string | null>(null);
  const [pauseModalSubscriptionId, setPauseModalSubscriptionId] = useState<string | null>(
    null
  );
  const [pauseUntilDate, setPauseUntilDate] = useState("");
  const [pauseModalError, setPauseModalError] = useState<string | null>(null);
  const baseCurrency = getBaseCurrency();
  const [needsAccountOnly, setNeedsAccountOnly] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const saved = window.localStorage.getItem(
        "cashcove:subscriptions:needsAccountOnly"
      );
      if (saved === null) {
        return false;
      }
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get("action");
  const formVisible = isFormOpen || actionParam === "new";
  const [isBulkPosting, setIsBulkPosting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
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
    SavedFilter<SubscriptionFilters>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));

  useEffect(() => {
    const hasSearchPreset = [
      "q",
      "status",
      "account",
      "from",
      "to",
      "min",
      "max",
    ].some((key) => searchParams.has(key));

    if (!hasSearchPreset) {
      return;
    }

    setSearch(searchParams.get("q") ?? "");
    setFilterStatus(searchParams.get("status") ?? "");
    setFilterAccount(searchParams.get("account") ?? "");
    setFilterFrom(searchParams.get("from") ?? "");
    setFilterTo(searchParams.get("to") ?? "");
    setMinAmount(searchParams.get("min") ?? "");
    setMaxAmount(searchParams.get("max") ?? "");
  }, [searchParams]);

  const { data: subscriptions = [], isLoading } = useGetSubscriptionsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();

  const [addTransaction] = useAddTransactionMutation();
  const [updateSubscription] = useUpdateSubscriptionMutation();

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
  const subscriptionMap = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.id, subscription])),
    [subscriptions]
  );

  const selectedSubscription = editingId
    ? subscriptionMap.get(editingId) ?? null
    : null;
  const postModalSubscription = postModalSubscriptionId
    ? subscriptionMap.get(postModalSubscriptionId) ?? null
    : null;
  const pauseModalSubscription = pauseModalSubscriptionId
    ? subscriptionMap.get(pauseModalSubscriptionId) ?? null
    : null;

  const monthKey = dayjs().format("YYYY-MM");
  const totals = useMemo(
    () => calculateSubscriptionTotals(subscriptions, monthKey),
    [subscriptions, monthKey]
  );
  const upcoming = useMemo(
    () => getUpcomingSubscriptions(subscriptions, 30),
    [subscriptions]
  );
  const upcomingTotal = useMemo(
    () => upcoming.reduce((sum, sub) => sum + getSubscriptionPlanningAmount(sub), 0),
    [upcoming]
  );
  const foreignCurrencyCount = useMemo(
    () => subscriptions.filter((sub) => isForeignCurrencySubscription(sub)).length,
    [subscriptions]
  );
  const dueThisWeek = useMemo(() => {
    const today = dayjs().startOf("day");
    return subscriptions.filter((sub) => {
      if (sub.status !== "active" || !sub.next_due) {
        return false;
      }
      const daysAway = dayjs(sub.next_due).diff(today, "day");
      return daysAway >= 0 && daysAway <= 7;
    });
  }, [subscriptions]);
  const dueThisWeekEligible = useMemo(
    () =>
      dueThisWeek.filter(
        (sub) => sub.account_id && !isForeignCurrencySubscription(sub)
      ),
    [dueThisWeek]
  );
  const dueThisWeekNeedsManualReview = useMemo(
    () =>
      dueThisWeek.filter(
        (sub) => sub.account_id && isForeignCurrencySubscription(sub)
      ).length,
    [dueThisWeek]
  );
  const dueThisWeekNeedsAccount = useMemo(
    () => dueThisWeek.filter((sub) => !sub.account_id).length,
    [dueThisWeek]
  );

  const filteredSubscriptions = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      const planningAmount = getSubscriptionPlanningAmount(sub);
      if (needsAccountOnly && sub.account_id) {
        return false;
      }
      if (filterStatus && sub.status !== filterStatus) {
        return false;
      }
      if (filterAccount && sub.account_id !== filterAccount) {
        return false;
      }
      if (filterFrom && sub.next_due < filterFrom) {
        return false;
      }
      if (filterTo && sub.next_due > filterTo) {
        return false;
      }
      if (minAmount && planningAmount < Number(minAmount)) {
        return false;
      }
      if (maxAmount && planningAmount > Number(maxAmount)) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const categoryLabel = sub.category_id
        ? categoryMap.get(sub.category_id) ?? ""
        : "";
      const accountLabel = sub.account_id
        ? accountMap.get(sub.account_id) ?? ""
        : "";
      const paymentLabel = sub.payment_method_id
        ? paymentMap.get(sub.payment_method_id) ?? ""
        : "";
      const notesLabel = sub.notes ?? "";
      const amountLabels = getSubscriptionAmountSearchTexts(sub).join(" ");
      const haystack =
        `${sub.name} ${categoryLabel} ${accountLabel} ${paymentLabel} ${notesLabel} ${amountLabels}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [
    subscriptions,
    needsAccountOnly,
    filterStatus,
    filterAccount,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    search,
    categoryMap,
    accountMap,
    paymentMap,
  ]);

  const rows = useMemo<SubscriptionRow[]>(
    () =>
      filteredSubscriptions.map((sub) => ({
        id: sub.id,
        name: sub.name,
        cadence: formatIntervalLabel(sub.interval_months),
        next_due: sub.next_due
          ? dayjs(sub.next_due).format("DD MMM YYYY")
          : "-",
        next_due_raw: sub.next_due,
        amount: getSubscriptionPlanningAmount(sub),
        amount_label: getSubscriptionPlanningAmountLabel(sub),
        amount_detail: isForeignCurrencySubscription(sub)
          ? getSubscriptionNativeAmountLabel(sub)
          : null,
        status: sub.status,
        account: accountMap.get(sub.account_id ?? "") ?? "-",
        category: categoryMap.get(sub.category_id ?? "") ?? "-",
        payment: paymentMap.get(sub.payment_method_id ?? "") ?? "-",
        overdue: isSubscriptionOverdue(sub),
        hasAccount: Boolean(sub.account_id),
        requiresManualPost: isForeignCurrencySubscription(sub),
      })),
    [filteredSubscriptions, accountMap, categoryMap, paymentMap]
  );

  const clearActionParam = () => {
    if (!actionParam) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  const clearScheduleError = (subscriptionId: string) => {
    setScheduleErrors((prev) => {
      if (!prev[subscriptionId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[subscriptionId];
      return next;
    });
  };

  const closePostModal = () => {
    setPostModalSubscriptionId(null);
    setPostModalAmount("");
    setPostModalError(null);
  };

  const closePauseModal = () => {
    setPauseModalSubscriptionId(null);
    setPauseUntilDate("");
    setPauseModalError(null);
  };

  const postSubscriptionPayment = useCallback(
    async (subscription: Subscription, billedInrAmount: number) => {
      if (isReadOnly) {
        return false;
      }

      const subscriptionId = subscription.id;
      setPostErrors((prev) => {
        if (!prev[subscriptionId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[subscriptionId];
        return next;
      });

      if (!subscription.account_id) {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]:
            "Select an account before posting a subscription payment.",
        }));
        return false;
      }

      if (!subscription.next_due) {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]: "Subscription needs a next due date before posting.",
        }));
        return false;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]:
            "Posting subscription payments requires internet connectivity.",
        }));
        return false;
      }

      setPostingId(subscription.id);
      try {
        const isForeign = isForeignCurrencySubscription(subscription);
        const nativeChargeNote = isForeign
          ? `Native charge: ${getSubscriptionNativeAmountLabel(subscription)}`
          : null;
        const notes = subscription.notes?.trim()
          ? nativeChargeNote
            ? `${subscription.notes.trim()} · ${nativeChargeNote}`
            : subscription.notes.trim()
          : nativeChargeNote
            ? `Subscription: ${subscription.name} · ${nativeChargeNote}`
            : `Subscription: ${subscription.name}`;

        await addTransaction({
          type: "expense",
          date: subscription.next_due,
          amount: billedInrAmount,
          category_id: subscription.category_id,
          payment_method_id: subscription.payment_method_id,
          account_id: subscription.account_id,
          notes,
          tags: [],
          offlineQueue: "disallow",
          is_transfer: false,
          is_recurring: true,
        }).unwrap();

        const nextDue = dayjs(subscription.next_due)
          .add(subscription.interval_months, "month")
          .format("YYYY-MM-DD");
        const fxRate =
          subscription.amount > 0 ? billedInrAmount / subscription.amount : null;

        await updateSubscription({
          ...subscription,
          estimated_base_amount: isForeign
            ? billedInrAmount
            : subscription.estimated_base_amount,
          last_paid: subscription.next_due,
          last_billed_base_amount: billedInrAmount,
          last_fx_rate: fxRate,
          next_due: nextDue,
        }).unwrap();
        setPostErrors((prev) => {
          if (!prev[subscriptionId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[subscriptionId];
          return next;
        });
        return true;
      } catch {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]: "Unable to post the subscription payment.",
        }));
        return false;
      } finally {
        setPostingId(null);
      }
    },
    [addTransaction, isReadOnly, updateSubscription]
  );

  const updateSubscriptionSchedule = useCallback(
    async ({
      subscription,
      nextDue,
    }: {
      subscription: Subscription;
      nextDue: string;
    }) => {
      if (isReadOnly) {
        return false;
      }
      if (!nextDue) {
        setScheduleErrors((prev) => ({
          ...prev,
          [subscription.id]: "Choose a valid next due date.",
        }));
        return false;
      }

      clearScheduleError(subscription.id);
      setSchedulingId(subscription.id);
      try {
        await updateSubscription({
          ...subscription,
          next_due: nextDue,
        }).unwrap();
        return true;
      } catch {
        setScheduleErrors((prev) => ({
          ...prev,
          [subscription.id]: "Unable to update the subscription schedule.",
        }));
        return false;
      } finally {
        setSchedulingId(null);
      }
    },
    [isReadOnly, updateSubscription]
  );

  const handleSkipNextCycle = useCallback(
    async (subscriptionId: string) => {
      const subscription = subscriptionMap.get(subscriptionId);
      if (!subscription || !subscription.next_due) {
        return;
      }
      const nextDue = dayjs(subscription.next_due)
        .add(Math.max(1, subscription.interval_months), "month")
        .format("YYYY-MM-DD");
      await updateSubscriptionSchedule({ subscription, nextDue });
    },
    [subscriptionMap, updateSubscriptionSchedule]
  );

  const handleOpenPauseUntil = useCallback(
    (subscriptionId: string) => {
      const subscription = subscriptionMap.get(subscriptionId);
      if (!subscription || !subscription.next_due) {
        return;
      }
      clearScheduleError(subscription.id);
      setPauseModalSubscriptionId(subscription.id);
      setPauseUntilDate(
        dayjs(subscription.next_due)
          .add(Math.max(1, subscription.interval_months), "month")
          .format("YYYY-MM-DD")
      );
      setPauseModalError(null);
    },
    [subscriptionMap]
  );

  const handlePostPayment = useCallback(
    async (subscriptionId: string) => {
      if (isReadOnly) {
        return false;
      }
      const subscription = subscriptionMap.get(subscriptionId);
      if (!subscription) {
        return false;
      }
      if (isForeignCurrencySubscription(subscription)) {
        setPostModalSubscriptionId(subscription.id);
        setPostModalAmount(
          String(
            subscription.last_billed_base_amount ??
              getSubscriptionPlanningAmount(subscription)
          )
        );
        setPostModalError(null);
        return false;
      }

      return postSubscriptionPayment(subscription, subscription.amount);
    },
    [isReadOnly, postSubscriptionPayment, subscriptionMap]
  );
  const handleBulkPost = useCallback(async () => {
    if (isReadOnly || isBulkPosting || dueThisWeekEligible.length === 0) {
      return;
    }
    setIsBulkPosting(true);
    setBulkSummary(null);
    let success = 0;
    let failed = 0;
    for (const subscription of dueThisWeekEligible) {
      const ok = await handlePostPayment(subscription.id);
      if (ok) {
        success += 1;
      } else {
        failed += 1;
      }
    }
    setBulkSummary({
      total: success + failed,
      success,
      failed,
    });
    setIsBulkPosting(false);
  }, [dueThisWeekEligible, handlePostPayment, isBulkPosting, isReadOnly]);

  const handleConfirmForeignPayment = useCallback(async () => {
    if (!postModalSubscription) {
      return;
    }
    const billedInrAmount = Number(postModalAmount);
    if (!Number.isFinite(billedInrAmount) || billedInrAmount < 0) {
      setPostModalError(`Enter the actual ${baseCurrency} charge.`);
      return;
    }
    setPostModalError(null);
    const ok = await postSubscriptionPayment(postModalSubscription, billedInrAmount);
    if (ok) {
      closePostModal();
    }
  }, [baseCurrency, postModalAmount, postModalSubscription, postSubscriptionPayment]);

  const handleConfirmPauseUntil = useCallback(async () => {
    if (!pauseModalSubscription) {
      return;
    }
    if (!pauseUntilDate) {
      setPauseModalError("Choose the date when billing should resume.");
      return;
    }

    const chosenDate = dayjs(pauseUntilDate);
    const currentDue = dayjs(pauseModalSubscription.next_due);
    if (!chosenDate.isValid()) {
      setPauseModalError("Choose a valid resume date.");
      return;
    }
    if (!chosenDate.isAfter(currentDue, "day")) {
      setPauseModalError("Resume date must be after the current due date.");
      return;
    }

    setPauseModalError(null);
    const ok = await updateSubscriptionSchedule({
      subscription: pauseModalSubscription,
      nextDue: chosenDate.format("YYYY-MM-DD"),
    });
    if (ok) {
      closePauseModal();
    }
  }, [pauseModalSubscription, pauseUntilDate, updateSubscriptionSchedule]);

  const columns = useMemo<ColDef<SubscriptionRow>[]>(
    () => [
      { headerName: "Subscription", field: "name", flex: 1.3 },
      { headerName: "Cadence", field: "cadence", maxWidth: 160 },
      {
        headerName: "Next due",
        field: "next_due",
        flex: 1.1,
        minWidth: 200,
        cellClass: "datatrix-cell-top datatrix-cell-wrap",
        cellRenderer: SubscriptionNextDueCell,
      },
      {
        headerName: "Amount",
        field: "amount",
        minWidth: 180,
        cellClass: "datatrix-cell-top datatrix-cell-wrap",
        cellRenderer: SubscriptionAmountCell,
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 160,
        cellRenderer: SubscriptionStatusCell,
      },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Category", field: "category", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Actions",
        field: "id",
        minWidth: 150,
        maxWidth: 170,
        sortable: false,
        cellRenderer: SubscriptionActionsCell,
        cellRendererParams: {
          onPostPayment: handlePostPayment,
          onSkipNextCycle: handleSkipNextCycle,
          onOpenPauseUntil: handleOpenPauseUntil,
          postingId,
          schedulingId,
          isBulkPosting,
          postErrors,
          scheduleErrors,
          readOnly: isReadOnly,
        },
      },
    ],
    [
      handleOpenPauseUntil,
      handlePostPayment,
      handleSkipNextCycle,
      isBulkPosting,
      isReadOnly,
      postErrors,
      postingId,
      scheduleErrors,
      schedulingId,
    ]
  );

  const handleOpenCreate = () => {
    if (isReadOnly) {
      return;
    }
    setEditingId(null);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:subscriptions:needsAccountOnly",
        String(needsAccountOnly)
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [needsAccountOnly]);

  const handleEditSubscription = (id: string) => {
    if (isReadOnly) {
      return;
    }
    setEditingId(id);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    clearActionParam();
  };

  const formKey = `${selectedSubscription?.id ?? "new"}-${
    formVisible ? "open" : "closed"
  }`;
  const dueThisWeekLabel =
    dueThisWeekEligible.length > 0
      ? `Post all ${baseCurrency} due this week (${dueThisWeekEligible.length})`
      : `Post all ${baseCurrency} due this week`;
  const totalCount = subscriptions.length;
  const filteredCount = filteredSubscriptions.length;
  const countLabel =
    totalCount === filteredCount
      ? `${totalCount} items`
      : `${filteredCount} of ${totalCount} items`;
  const activeCount = useMemo(
    () => subscriptions.filter((sub) => sub.status === "active").length,
    [subscriptions]
  );
  const overdueCount = useMemo(
    () =>
      subscriptions.filter(
        (sub) =>
          sub.status === "active" && sub.next_due && isSubscriptionOverdue(sub)
      ).length,
    [subscriptions]
  );
  const subscriptionStatusChips = useMemo(
    () => [
      {
        id: "visible",
        label: `${filteredCount} visible`,
        color: "blue",
        tooltip:
          filteredCount === totalCount
            ? "All subscriptions are visible."
            : `${totalCount} total subscriptions are being tracked.`,
      },
      {
        id: "active",
        label: `${activeCount} active`,
        color: activeCount > 0 ? "teal" : "gray",
        tooltip: "Subscriptions currently set to active.",
      },
      {
        id: "overdue",
        label: `${overdueCount} overdue`,
        color: overdueCount > 0 ? "red" : "gray",
        tooltip: "Active subscriptions with a past due date.",
      },
    ],
    [activeCount, filteredCount, overdueCount, totalCount]
  );
  const emptyLabel =
    totalCount === 0
      ? "No subscriptions yet. Add one to get started."
      : "No subscriptions match these filters.";
  const bulkSummaryLabel = bulkSummary
    ? bulkSummary.failed === 0
      ? `Posted ${bulkSummary.success} payment${
          bulkSummary.success === 1 ? "" : "s"
        }.`
      : `Posted ${bulkSummary.success}/${bulkSummary.total}. ${bulkSummary.failed} failed.`
    : null;
  const bulkSummaryColor =
    bulkSummary && bulkSummary.failed === 0 ? "teal.7" : "orange.6";

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
    if (filterStatus) {
      chips.push({
        key: "status",
        label: `Status: ${filterStatus}`,
        onClear: () => setFilterStatus(""),
      });
    }
    if (filterAccount) {
      chips.push({
        key: "account",
        label: `Account: ${accountMap.get(filterAccount) ?? "Unknown"}`,
        onClear: () => setFilterAccount(""),
      });
    }
    if (filterFrom || filterTo) {
      const fromLabel = filterFrom
        ? dayjs(filterFrom).format("DD MMM")
        : "Any";
      const toLabel = filterTo ? dayjs(filterTo).format("DD MMM") : "Any";
      chips.push({
        key: "due",
        label: `Due: ${fromLabel} → ${toLabel}`,
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
    if (needsAccountOnly) {
      chips.push({
        key: "needs-account",
        label: "Needs account",
        onClear: () => setNeedsAccountOnly(false),
      });
    }
    return chips;
  }, [
    search,
    filterStatus,
    filterAccount,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    needsAccountOnly,
    accountMap,
  ]);
  const hasActiveFilters = activeChips.length > 0;
  const advancedFilterCount = activeChips.filter(
    (chip) => chip.key !== "search" && chip.key !== "needs-account"
  ).length;
  const visibleFilterChips = filtersExpanded
    ? activeChips
    : activeChips.filter((chip) => chip.key !== "search");

  const persistSavedFilters = (next: SavedFilter<SubscriptionFilters>[]) => {
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
    setSearch(match.value.search);
    setFilterStatus(match.value.status);
    setFilterAccount(match.value.accountId);
    setFilterFrom(match.value.dueFrom);
    setFilterTo(match.value.dueTo);
    setMinAmount(match.value.minAmount);
    setMaxAmount(match.value.maxAmount);
  };

  const handleSaveCurrentFilters = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const value: SubscriptionFilters = {
      search,
      status: filterStatus,
      accountId: filterAccount,
      dueFrom: filterFrom,
      dueTo: filterTo,
      minAmount,
      maxAmount,
    };
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
    setSearch("");
    setFilterStatus("");
    setFilterAccount("");
    setFilterFrom("");
    setFilterTo("");
    setMinAmount("");
    setMaxAmount("");
    setNeedsAccountOnly(false);
    setSelectedSavedId(null);
  };

  return (
    <Stack gap="lg">
      <Modal
        opened={Boolean(pauseModalSubscription)}
        onClose={closePauseModal}
        title="Pause until"
        size="sm"
      >
        <Stack gap="sm">
          {pauseModalSubscription ? (
            <>
              <Text size="sm">
                Move the next due date for {pauseModalSubscription.name} without
                cancelling the subscription.
              </Text>
              <Text size="xs" c="dimmed">
                Current due date:{" "}
                {dayjs(pauseModalSubscription.next_due).format("DD MMM YYYY")}
              </Text>
              <DateInput
                label="Resume billing on"
                value={pauseUntilDate ? new Date(pauseUntilDate) : null}
                onChange={(value) => {
                  setPauseUntilDate(
                    value ? new Date(value).toISOString().slice(0, 10) : ""
                  );
                }}
                clearable={false}
                required
              />
              {pauseModalError ? (
                <Text size="xs" c="red.6">
                  {pauseModalError}
                </Text>
              ) : null}
            </>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={closePauseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPauseUntil}
              loading={
                pauseModalSubscription
                  ? schedulingId === pauseModalSubscription.id
                  : false
              }
              disabled={isReadOnly}
            >
              Save pause
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={Boolean(postModalSubscription)}
        onClose={closePostModal}
        title="Post foreign-currency payment"
        size="sm"
      >
        <Stack gap="sm">
          {postModalSubscription ? (
            <>
              <Text size="sm">
                {postModalSubscription.name} bills in{" "}
                {getSubscriptionNativeAmountLabel(postModalSubscription)}.
              </Text>
              <TextInput
                label={`Actual ${baseCurrency} charged`}
                type="number"
                value={postModalAmount}
                onChange={(event) => setPostModalAmount(event.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <Text size="xs" c="dimmed">
                Estimate: {getSubscriptionPlanningAmountLabel(postModalSubscription)}
                {postModalSubscription.last_billed_base_amount
                  ? ` · Last billed ${formatINR(postModalSubscription.last_billed_base_amount)}`
                  : ""}
              </Text>
              {postModalError ? (
                <Text size="xs" c="red.6">
                  {postModalError}
                </Text>
              ) : null}
            </>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={closePostModal}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmForeignPayment}
              loading={postModalSubscription ? postingId === postModalSubscription.id : false}
              disabled={isReadOnly}
            >
              Post payment
            </Button>
          </Group>
        </Stack>
      </Modal>
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
            placeholder="e.g., Due this week, Streaming only"
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
      <SubscriptionFormModal
        key={formKey}
        opened={formVisible}
        onClose={handleCloseForm}
        subscription={selectedSubscription}
        categories={categories}
        accounts={accounts}
        paymentMethods={paymentMethods}
        readOnly={isReadOnly}
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Estimated due this month
          </Text>
          <Title order={3}>{formatINR(totals.dueThisMonth)}</Title>
          {foreignCurrencyCount > 0 ? (
            <Text size="xs" c="dimmed">
              Includes FX estimates for {foreignCurrencyCount} foreign-currency subscriptions.
            </Text>
          ) : null}
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Estimated annual commitment
          </Text>
          <Title order={3}>{formatINR(totals.annualTotal)}</Title>
          {foreignCurrencyCount > 0 ? (
            <Text size="xs" c="dimmed">
              {`Updates automatically to the latest actual ${baseCurrency} charge after each posted payment.`}
            </Text>
          ) : null}
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Group justify="space-between" align="center" mb="xs">
            <Text size="sm" c="dimmed">
              Estimated due in 30 days
            </Text>
            <Badge variant="light" color="blue">
              {upcoming.length} renewals
            </Badge>
          </Group>
          <Title order={3}>{formatINR(upcomingTotal)}</Title>
          {foreignCurrencyCount > 0 ? (
            <Text size="xs" c="dimmed">
              Foreign-currency renewals use the latest saved {baseCurrency} planning amount.
            </Text>
          ) : null}
        </Paper>
      </SimpleGrid>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Subscriptions</Title>
            <Text size="sm" c="dimmed">
              {countLabel}
            </Text>
            <PageStatusChips items={subscriptionStatusChips} />
            <Text size="xs" c="dimmed">
              Click a row to edit. Use the action menu to skip a cycle or pause billing.
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Switch
              size="sm"
              label="Needs account"
              checked={needsAccountOnly}
              onChange={(event) =>
                setNeedsAccountOnly(event.currentTarget.checked)
              }
            />
            <Stack gap={4} align="flex-end">
              <Button
                variant="light"
                loading={isBulkPosting}
                disabled={dueThisWeekEligible.length === 0 || isReadOnly}
                onClick={handleBulkPost}
              >
                {dueThisWeekLabel}
              </Button>
              {dueThisWeekNeedsAccount > 0 ? (
                <Text size="xs" c="dimmed">
                  {dueThisWeekNeedsAccount} due this week need an account
                </Text>
              ) : null}
              {dueThisWeekNeedsManualReview > 0 ? (
                <Text size="xs" c="dimmed">
                  {`${dueThisWeekNeedsManualReview} foreign-currency charges need manual ${baseCurrency} confirmation`}
                </Text>
              ) : null}
              {bulkSummaryLabel ? (
                <Text size="xs" c={bulkSummaryColor}>
                  {bulkSummaryLabel}
                </Text>
              ) : null}
            </Stack>
            {isMobile ? (
              <Menu position="bottom-end" withArrow>
                <Menu.Target>
                  <ActionIcon variant="light" size="lg" aria-label="Actions">
                    <MoreHorizontal size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<Plus size={16} strokeWidth={2} />}
                    onClick={handleOpenCreate}
                    disabled={isReadOnly}
                  >
                    Add subscription
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button
                leftSection={<Plus size={16} strokeWidth={2} />}
                onClick={handleOpenCreate}
                disabled={isReadOnly}
              >
                Add subscription
              </Button>
            )}
          </Group>
        </Group>
        <Stack gap="sm" mb="md">
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
                  placeholder="Name, category, account"
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
                    label="Status"
                    data={[
                      { value: "active", label: "Active" },
                      { value: "paused", label: "Paused" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                    value={filterStatus || null}
                    onChange={(value) => setFilterStatus(value ?? "")}
                    clearable
                    size="xs"
                  />
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
                  <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                    <DateInput
                      label="Due from"
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
                      label="Due to"
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
          height="max(420px, calc(100vh - 320px))"
          emptyLabel={emptyLabel}
          loading={isLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => handleEditSubscription(row.id)}
          rowHeight={68}
        />
      </Paper>
    </Stack>
  );
};
