import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Paper,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import {
  ArrowUpRight,
  Filter,
  Landmark,
  PiggyBank,
  Save,
  Search,
  Tag as TagIcon,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { APP_BASE_PATH, appPath } from "../../app/paths";
import { useAppMonth } from "../../context/AppMonthContext";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetFundsQuery,
  useGetLoansQuery,
  useGetSubscriptionsQuery,
  useGetTagsQuery,
  useGetTransactionsByRangeQuery,
} from "../../features/api/apiSlice";
import { formatINR } from "../../lib/format";
import { scoreSearchMatch } from "../../lib/globalSearch";
import {
  loadSavedFilters,
  saveSavedFilters,
  type SavedFilter,
} from "../../lib/savedFilters";
import {
  getDisplayCategoryId,
  getTransactionCounterpartyName,
  isReimbursement,
} from "../../lib/transactions";
import { getDisplayAmount } from "../../lib/moneyConfig";
import {
  getSubscriptionAmountSearchTexts,
  getSubscriptionNativeAmountLabel,
  getSubscriptionPlanningAmount,
  getSubscriptionPlanningAmountLabel,
  isForeignCurrencySubscription,
} from "../../lib/subscriptions";
import { ActiveFilterChips, type ActiveFilterChip } from "../filters/ActiveFilterChips";

type GlobalSearchScope = "all" | "transactions" | "subscriptions";

type GlobalSearchFilters = {
  scope: GlobalSearchScope;
  search: string;
  accountId: string;
  tag: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
};

type GlobalSearchDrawerProps = {
  opened: boolean;
  onClose: () => void;
  onOpenQuickAdd?: () => void;
  onOpenQuickActions?: () => void;
};

type SearchResultCardItem = {
  id: string;
  badge: string;
  color: string;
  title: string;
  description: string;
  meta?: string;
  onSelect: () => void;
};

const buildFiltersKey = (userId: string | null) =>
  `cashcove:filters:global:${userId ?? "anon"}`;

const buildDefaultRange = () => ({
  start: dayjs().subtract(365, "day"),
  end: dayjs(),
});

const formatDateRangeLabel = (from: string, to: string) => {
  const fromLabel = from ? dayjs(from).format("DD MMM") : "Any";
  const toLabel = to ? dayjs(to).format("DD MMM") : "Any";
  return `${fromLabel} → ${toLabel}`;
};

const buildSearchString = (params: Record<string, string | null | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const normalized =
      typeof value === "string" ? value.trim() : value ?? undefined;
    if (normalized) {
      searchParams.set(key, normalized);
    }
  });
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
};

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const SearchResultCard = ({
  badge,
  color,
  title,
  description,
  meta,
  onSelect,
}: SearchResultCardItem) => (
  <Paper
    withBorder
    radius="md"
    p="sm"
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    }}
    style={{
      background: "var(--surface-alt)",
      cursor: "pointer",
    }}
  >
    <Group justify="space-between" align="center" wrap="nowrap">
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs" align="center" wrap="wrap">
          <Badge variant="light" color={color} radius="sm">
            {badge}
          </Badge>
          {meta ? (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {meta}
            </Text>
          ) : null}
        </Group>
        <Text fw={600} size="sm" lineClamp={1}>
          {title}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {description}
        </Text>
      </Stack>
      <ArrowUpRight size={14} />
    </Group>
  </Paper>
);

export const GlobalSearchDrawer = ({
  opened,
  onClose,
  onOpenQuickAdd,
  onOpenQuickActions,
}: GlobalSearchDrawerProps) => {
  const navigate = useNavigate();
  const { setMonth } = useAppMonth();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [scope, setScope] = useState<GlobalSearchScope>("all");
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<GlobalSearchFilters>[]
  >([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: tags = [] } = useGetTagsQuery();
  const { data: subscriptions = [] } = useGetSubscriptionsQuery();
  const { data: funds = [] } = useGetFundsQuery();
  const { data: loans = [] } = useGetLoansQuery();

  const resolvedRange = useMemo(() => {
    const fallback = buildDefaultRange();
    const start = dateFrom ? dayjs(dateFrom) : fallback.start;
    const end = dateTo ? dayjs(dateTo) : fallback.end;
    const [safeStart, safeEnd] = start.isAfter(end) ? [end, start] : [start, end];
    return {
      start: safeStart.format("YYYY-MM-DD"),
      end: safeEnd.format("YYYY-MM-DD"),
    };
  }, [dateFrom, dateTo]);

  const showTransactions = scope !== "subscriptions";
  const { data: transactions = [] } = useGetTransactionsByRangeQuery(
    resolvedRange,
    { skip: !showTransactions }
  );

  useEffect(() => {
    setSavedFilters(loadSavedFilters(buildFiltersKey(userId)));
  }, [userId]);

  useEffect(() => {
    if (!opened) {
      return;
    }
    const timer = globalThis.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => globalThis.clearTimeout(timer);
  }, [opened]);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
  const accountCurrencyMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.currency])),
    [accounts]
  );

  const minValue = Number(minAmount);
  const maxValue = Number(maxAmount);
  const minBound = Number.isNaN(minValue) ? null : minValue;
  const maxBound = Number.isNaN(maxValue) ? null : maxValue;
  const searchQuery = search.trim();
  const hasAdvancedFilters = Boolean(
    accountId || tag || status || dateFrom || dateTo || minAmount || maxAmount
  );

  const latestTransactionByAccountId = useMemo(() => {
    const latest = new Map<string, string>();
    transactions.forEach((tx) => {
      if (!tx.account_id) {
        return;
      }
      const existing = latest.get(tx.account_id);
      if (!existing || tx.date > existing) {
        latest.set(tx.account_id, tx.date);
      }
    });
    return latest;
  }, [transactions]);

  const latestTransactionByTag = useMemo(() => {
    const latest = new Map<string, string>();
    transactions.forEach((tx) => {
      (tx.tags ?? []).forEach((tagItem) => {
        const existing = latest.get(tagItem.name);
        if (!existing || tx.date > existing) {
          latest.set(tagItem.name, tx.date);
        }
      });
    });
    return latest;
  }, [transactions]);

  const latestTransactionByCategoryId = useMemo(() => {
    const latest = new Map<string, string>();
    transactions.forEach((tx) => {
      const categoryId = getDisplayCategoryId(tx);
      if (!categoryId) {
        return;
      }
      const existing = latest.get(categoryId);
      if (!existing || tx.date > existing) {
        latest.set(categoryId, tx.date);
      }
    });
    return latest;
  }, [transactions]);

  const tagUsageCounts = useMemo(() => {
    const usage = new Map<string, number>();
    transactions.forEach((tx) => {
      (tx.tags ?? []).forEach((tagItem) => {
        usage.set(tagItem.name, (usage.get(tagItem.name) ?? 0) + 1);
      });
    });
    return usage;
  }, [transactions]);

  const categoryUsageCounts = useMemo(() => {
    const usage = new Map<string, number>();
    transactions.forEach((tx) => {
      const categoryId = getDisplayCategoryId(tx);
      if (categoryId) {
        usage.set(categoryId, (usage.get(categoryId) ?? 0) + 1);
      }
    });
    subscriptions.forEach((sub) => {
      if (sub.category_id) {
        usage.set(sub.category_id, (usage.get(sub.category_id) ?? 0) + 1);
      }
    });
    return usage;
  }, [subscriptions, transactions]);

  const filteredTransactions = useMemo(() => {
    if (!showTransactions) {
      return [];
    }
    return transactions
      .map((tx) => {
        if (accountId && tx.account_id !== accountId) {
          return null;
        }
        if (tag && !tx.tags?.some((item) => item.name === tag)) {
          return null;
        }
        if (dateFrom && tx.date < dateFrom) {
          return null;
        }
        if (dateTo && tx.date > dateTo) {
          return null;
        }
        const txSourceCurrency = tx.account_id
          ? accountCurrencyMap.get(tx.account_id) ?? null
          : tx.currency ?? null;
        const comparableAmount =
          getDisplayAmount(tx.amount, txSourceCurrency) ?? tx.amount;
        if (minBound !== null && comparableAmount < minBound) {
          return null;
        }
        if (maxBound !== null && comparableAmount > maxBound) {
          return null;
        }

        const categoryId = getDisplayCategoryId(tx);
        const categoryName = categoryId
          ? categoryMap.get(categoryId) ?? "Uncategorized"
          : "Uncategorized";
        const accountName = tx.account_id
          ? accountMap.get(tx.account_id) ?? "No account"
          : "No account";
        const tagNames = tx.tags?.map((item) => item.name) ?? [];
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: getTransactionCounterpartyName(tx) || categoryName || tx.type,
          aliasTexts: [
            categoryName,
            accountName,
            tx.notes ?? "",
            tx.type,
            ...tagNames,
          ],
          valueTexts: [
            tx.amount.toString(),
            String(comparableAmount),
            formatINR(tx.amount, txSourceCurrency),
            dayjs(tx.date).format("DD MMM YYYY"),
          ],
        });

        if (searchQuery && score === null) {
          return null;
        }

        return {
          tx,
          categoryName,
          accountName,
          tagNames,
          score: score ?? 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort(
        (a, b) => b.score - a.score || dayjs(b.tx.date).diff(dayjs(a.tx.date))
      );
  }, [
    accountId,
    accountCurrencyMap,
    accountMap,
    categoryMap,
    dateFrom,
    dateTo,
    maxBound,
    minBound,
    searchQuery,
    showTransactions,
    tag,
    transactions,
  ]);

  const filteredSubscriptions = useMemo(() => {
    if (scope === "transactions") {
      return [];
    }
    return subscriptions
      .map((sub) => {
        if (status && sub.status !== status) {
          return null;
        }
        if (accountId && sub.account_id !== accountId) {
          return null;
        }
        if (dateFrom && sub.next_due < dateFrom) {
          return null;
        }
        if (dateTo && sub.next_due > dateTo) {
          return null;
        }
        const planningAmount = getSubscriptionPlanningAmount(sub);
        if (minBound !== null && planningAmount < minBound) {
          return null;
        }
        if (maxBound !== null && planningAmount > maxBound) {
          return null;
        }

        const categoryName = sub.category_id
          ? categoryMap.get(sub.category_id) ?? "Uncategorized"
          : "Uncategorized";
        const accountName = sub.account_id
          ? accountMap.get(sub.account_id) ?? "No account"
          : "No account";
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: sub.name,
          aliasTexts: [
            sub.notes ?? "",
            categoryName,
            accountName,
            sub.status,
          ],
          valueTexts: [
            ...getSubscriptionAmountSearchTexts(sub),
            dayjs(sub.next_due).format("DD MMM YYYY"),
          ],
        });

        if (searchQuery && score === null) {
          return null;
        }

        return {
          sub,
          categoryName,
          accountName,
          score: score ?? 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort(
        (a, b) =>
          b.score - a.score || dayjs(a.sub.next_due).diff(dayjs(b.sub.next_due))
      );
  }, [
    accountId,
    accountMap,
    categoryMap,
    dateFrom,
    dateTo,
    maxBound,
    minBound,
    scope,
    searchQuery,
    status,
    subscriptions,
  ]);

  const navigateTo = (path: string, params?: Record<string, string | null | undefined>) => {
    onClose();
    navigate({
      pathname: path,
      search: params ? buildSearchString(params) : "",
    });
  };

  const navigateToTransaction = (
    date: string,
    params?: Record<string, string | null | undefined>
  ) => {
    setMonth(dayjs(date).format("YYYY-MM"));
    navigateTo(appPath("/transactions"), params);
  };

  const shortcutResults = useMemo(() => {
    if (scope !== "all") {
      return [];
    }

    const shortcuts = [
      {
        id: "shortcut-overview",
        badge: "Page",
        color: "gray",
        title: "Overview",
        description: "Dashboard, cash position, budgets, and alerts",
        keywords: ["home dashboard summary"],
        onSelect: () => navigateTo(APP_BASE_PATH),
      },
      {
        id: "shortcut-transactions",
        badge: "Page",
        color: "blue",
        title: "Transactions",
        description: "Browse and refine money movement",
        keywords: ["expenses income ledger entries history"],
        onSelect: () => navigateTo(appPath("/transactions")),
      },
      {
        id: "shortcut-bills",
        badge: "Page",
        color: "indigo",
        title: "Bills",
        description: "Recurring bills, due dates, and upcoming outflows",
        keywords: ["calendar due subscriptions recurring payments"],
        onSelect: () => navigateTo(appPath("/bills")),
      },
      {
        id: "shortcut-subscriptions",
        badge: "Page",
        color: "grape",
        title: "Subscriptions",
        description: "Manage recurring services and posting",
        keywords: ["recurring services autopay memberships"],
        onSelect: () => navigateTo(appPath("/subscriptions")),
      },
      {
        id: "shortcut-funds",
        badge: "Page",
        color: "teal",
        title: "Funds",
        description: "Savings goals, contributions, and spending from funds",
        keywords: ["goals sinking funds savings buckets"],
        onSelect: () => navigateTo(appPath("/funds")),
      },
      {
        id: "shortcut-loans",
        badge: "Page",
        color: "orange",
        title: "Loans",
        description: "EMIs, schedules, payments, and rate revisions",
        keywords: ["emi debt lender repayment"],
        onSelect: () => navigateTo(appPath("/loans")),
      },
      {
        id: "shortcut-reports",
        badge: "Page",
        color: "cyan",
        title: "Reports",
        description: "Trends, analysis, and exported views",
        keywords: ["analytics charts cashflow reports"],
        onSelect: () => navigateTo(appPath("/reports")),
      },
      {
        id: "shortcut-settings",
        badge: "Page",
        color: "gray",
        title: "Settings",
        description: "Reference data, rules, and workspace controls",
        keywords: ["accounts categories payment methods tags rules"],
        onSelect: () => navigateTo(appPath("/settings")),
      },
      {
        id: "shortcut-quick-add",
        badge: "Action",
        color: "blue",
        title: "Quick add transaction",
        description: "Open the fast transaction drawer",
        keywords: ["new add expense income quick"],
        onSelect: () => {
          onClose();
          onOpenQuickAdd?.();
        },
      },
      {
        id: "shortcut-quick-actions",
        badge: "Action",
        color: "gray",
        title: "Quick actions",
        description: "Open the command menu for app-wide actions",
        keywords: ["command palette shortcuts actions"],
        onSelect: () => {
          onClose();
          onOpenQuickActions?.();
        },
      },
      {
        id: "shortcut-new-subscription",
        badge: "Action",
        color: "grape",
        title: "Create subscription",
        description: "Open the subscription form",
        keywords: ["new recurring service membership add subscription"],
        onSelect: () => navigateTo(appPath("/subscriptions"), { action: "new" }),
      },
    ];

    return shortcuts
      .map((item, index) => {
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: item.title,
          aliasTexts: [item.description, ...item.keywords],
        });

        if (searchQuery && score === null) {
          return null;
        }

        return {
          ...item,
          score: score ?? 1,
          order: index,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.score - a.score || a.order - b.order);
  }, [
    navigate,
    onClose,
    onOpenQuickActions,
    onOpenQuickAdd,
    scope,
    searchQuery,
  ]);

  const workspaceResults = useMemo(() => {
    if (scope !== "all" || !searchQuery) {
      return [];
    }

    const accountResults = accounts
      .map((account) => {
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: account.name,
          aliasTexts: [account.type, formatINR(account.current_balance, account.currency)],
          valueTexts: [String(account.current_balance)],
        });
        if (score === null) {
          return null;
        }
        const latestDate = latestTransactionByAccountId.get(account.id);
        return {
          id: `account-${account.id}`,
          badge: "Account",
          color: "blue",
          title: account.name,
          description: `${titleCase(account.type)} account`,
          meta: formatINR(account.current_balance, account.currency),
          score,
          onSelect: () => {
            if (latestDate) {
              setMonth(dayjs(latestDate).format("YYYY-MM"));
            }
            navigateTo(appPath("/transactions"), { account: account.id });
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const categoryResults = categories
      .map((category) => {
        const usage = categoryUsageCounts.get(category.id) ?? 0;
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: category.name,
          aliasTexts: [category.type, `${usage} matches`],
        });
        if (score === null) {
          return null;
        }
        const latestDate = latestTransactionByCategoryId.get(category.id);
        return {
          id: `category-${category.id}`,
          badge: "Category",
          color: category.type === "income" ? "teal" : "red",
          title: category.name,
          description: `${titleCase(category.type)} category`,
          meta: usage > 0 ? `${usage} matches` : "No recent activity",
          score,
          onSelect: () => {
            if (latestDate) {
              setMonth(dayjs(latestDate).format("YYYY-MM"));
            }
            navigateTo(appPath("/transactions"), { q: category.name });
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const tagResults = tags
      .map((item) => {
        const usage = tagUsageCounts.get(item.name) ?? 0;
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: item.name,
          aliasTexts: [`${usage} tagged transactions`],
        });
        if (score === null) {
          return null;
        }
        const latestDate = latestTransactionByTag.get(item.name);
        return {
          id: `tag-${item.id}`,
          badge: "Tag",
          color: "blue",
          title: item.name,
          description: "Transaction tag",
          meta: usage > 0 ? `${usage} matches` : "No recent activity",
          score,
          onSelect: () => {
            if (latestDate) {
              setMonth(dayjs(latestDate).format("YYYY-MM"));
            }
            navigateTo(appPath("/transactions"), { tag: item.name });
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const fundResults = funds
      .map((fund) => {
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: fund.name,
          aliasTexts: [fund.type ?? "", fund.notes ?? ""],
          valueTexts: [
            String(fund.current_amount),
            String(fund.target_amount),
            formatINR(fund.current_amount),
            formatINR(fund.target_amount),
          ],
        });
        if (score === null) {
          return null;
        }
        return {
          id: `fund-${fund.id}`,
          badge: "Fund",
          color: "teal",
          title: fund.name,
          description: fund.type?.trim() ? fund.type.trim() : "Savings fund",
          meta: `${formatINR(fund.current_amount)} of ${formatINR(fund.target_amount)}`,
          score,
          onSelect: () => navigateTo(appPath("/funds")),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const loanResults = loans
      .map((loan) => {
        const score = scoreSearchMatch({
          query: searchQuery,
          primaryText: loan.name,
          aliasTexts: [loan.lender_name ?? "", loan.loan_type ?? "", loan.status],
          valueTexts: [
            String(loan.emi_amount),
            String(loan.principal_outstanding),
            formatINR(loan.emi_amount),
            formatINR(loan.principal_outstanding),
          ],
        });
        if (score === null) {
          return null;
        }
        return {
          id: `loan-${loan.id}`,
          badge: "Loan",
          color: "orange",
          title: loan.name,
          description: loan.lender_name?.trim() ? loan.lender_name.trim() : "Loan account",
          meta: `Outstanding ${formatINR(loan.principal_outstanding)}`,
          score,
          onSelect: () => navigateTo(appPath("/loans")),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return [
      ...accountResults,
      ...categoryResults,
      ...tagResults,
      ...fundResults,
      ...loanResults,
    ].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }, [
    accounts,
    categories,
    categoryUsageCounts,
    funds,
    latestTransactionByAccountId,
    latestTransactionByCategoryId,
    latestTransactionByTag,
    loans,
    navigate,
    onClose,
    scope,
    searchQuery,
    setMonth,
    tagUsageCounts,
    tags,
  ]);

  const savedFilterOptions = useMemo(
    () => savedFilters.map((filter) => ({ value: filter.id, label: filter.name })),
    [savedFilters]
  );

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (scope !== "all") {
      chips.push({
        key: "scope",
        label: scope === "transactions" ? "Transactions only" : "Subscriptions only",
        onClear: () => setScope("all"),
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Search: ${search.trim()}`,
        onClear: () => setSearch(""),
      });
    }
    if (accountId) {
      chips.push({
        key: "account",
        label: `Account: ${accountMap.get(accountId) ?? "Unknown"}`,
        onClear: () => setAccountId(""),
      });
    }
    if (tag) {
      chips.push({
        key: "tag",
        label: `Tag: ${tag}`,
        onClear: () => setTag(""),
      });
    }
    if (status) {
      chips.push({
        key: "status",
        label: `Status: ${status}`,
        onClear: () => setStatus(""),
      });
    }
    if (dateFrom || dateTo) {
      chips.push({
        key: "date",
        label: `Dates: ${formatDateRangeLabel(dateFrom, dateTo)}`,
        onClear: () => {
          setDateFrom("");
          setDateTo("");
        },
      });
    }
    if (minAmount || maxAmount) {
      const minLabel = minAmount || "Any";
      const maxLabel = maxAmount || "Any";
      chips.push({
        key: "amount",
        label: `Amount: ${minLabel} → ${maxLabel}`,
        onClear: () => {
          setMinAmount("");
          setMaxAmount("");
        },
      });
    }
    return chips;
  }, [
    accountId,
    accountMap,
    dateFrom,
    dateTo,
    maxAmount,
    minAmount,
    scope,
    search,
    status,
    tag,
  ]);

  const persistSavedFilters = (next: SavedFilter<GlobalSearchFilters>[]) => {
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
    const value = match.value;
    setScope(value.scope);
    setSearch(value.search);
    setAccountId(value.accountId);
    setTag(value.tag);
    setStatus(value.status);
    setDateFrom(value.dateFrom);
    setDateTo(value.dateTo);
    setMinAmount(value.minAmount);
    setMaxAmount(value.maxAmount);
  };

  const handleSaveCurrentFilters = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const value: GlobalSearchFilters = {
      scope,
      search,
      accountId,
      tag,
      status,
      dateFrom,
      dateTo,
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

  const shortcutCount = shortcutResults.length;
  const workspaceCount = workspaceResults.length;
  const transactionCount = filteredTransactions.length;
  const subscriptionCount = filteredSubscriptions.length;
  const totalCount =
    shortcutCount + workspaceCount + transactionCount + subscriptionCount;
  const transactionPreviewCount =
    searchQuery || hasAdvancedFilters ? 25 : 8;
  const subscriptionPreviewCount =
    searchQuery || hasAdvancedFilters ? 25 : 8;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group gap="xs" align="center">
          <Search size={18} />
          <Title order={4}>Global search</Title>
        </Group>
      }
    >
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
            placeholder="e.g., Card spend, Upcoming renewals"
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setSaveModalOpen(false)}>
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

      <Stack gap="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text fw={600}>Search across CashCove</Text>
              <Text size="sm" c="dimmed">
                Pages, transactions, subscriptions, funds, loans, accounts, categories, and tags.
              </Text>
            </Stack>
            <Badge variant="light" color="blue">
              {totalCount} results
            </Badge>
          </Group>

          <TextInput
            ref={searchInputRef}
            placeholder="Search counterparties, pages, categories, tags, funds, loans, or amounts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftSection={<Search size={16} />}
          />

          <SegmentedControl
            value={scope}
            onChange={(value) => setScope(value as GlobalSearchScope)}
            data={[
              { label: "All", value: "all" },
              { label: "Transactions", value: "transactions" },
              { label: "Subscriptions", value: "subscriptions" },
            ]}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Account"
              data={accounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
              value={accountId || null}
              onChange={(value) => setAccountId(value ?? "")}
              clearable
              searchable
              size="xs"
            />
            <Select
              label="Tag"
              data={tags.map((item) => ({ value: item.name, label: item.name }))}
              value={tag || null}
              onChange={(value) => setTag(value ?? "")}
              clearable
              searchable
              size="xs"
              disabled={scope === "subscriptions"}
            />
            <Select
              label="Status"
              data={[
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              value={status || null}
              onChange={(value) => setStatus(value ?? "")}
              clearable
              size="xs"
              disabled={scope === "transactions"}
            />
            <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
              <DateInput
                label="From"
                value={dateFrom ? dayjs(dateFrom).toDate() : null}
                onChange={(value) =>
                  setDateFrom(value ? dayjs(value).format("YYYY-MM-DD") : "")
                }
                clearable
                size="xs"
                styles={{ input: { minWidth: 0 } }}
                style={{ flex: 1 }}
              />
              <DateInput
                label="To"
                value={dateTo ? dayjs(dateTo).toDate() : null}
                onChange={(value) => setDateTo(value ? dayjs(value).format("YYYY-MM-DD") : "")}
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
                  leftSection={<Filter size={14} strokeWidth={2} />}
                  style={{ width: "100%" }}
                >
                  Saved filters
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  <Select
                    label="Saved filters"
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
                      Save
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
          </SimpleGrid>

          <ActiveFilterChips items={activeChips} />
        </Stack>

        <Divider />

        {totalCount === 0 ? (
          <Text size="sm" c="dimmed">
            No matches yet. Try a broader phrase, widen the date range, or clear a filter.
          </Text>
        ) : (
          <ScrollArea h={520} type="auto">
            <Stack gap="lg">
              {scope === "all" ? (
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text fw={600}>Jump to</Text>
                    <Badge variant="light" color="blue">
                      {shortcutCount}
                    </Badge>
                  </Group>
                  {shortcutResults.slice(0, searchQuery ? 8 : 6).map((item) => (
                    <SearchResultCard key={item.id} {...item} />
                  ))}
                </Stack>
              ) : null}

              {scope === "all" && workspaceResults.length > 0 ? (
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs" align="center">
                      <Wallet size={16} />
                      <Text fw={600}>Workspace</Text>
                    </Group>
                    <Badge variant="light" color="blue">
                      {workspaceCount}
                    </Badge>
                  </Group>
                  {workspaceResults.slice(0, 12).map((item) => {
                    const icon =
                      item.badge === "Fund" ? (
                        <PiggyBank size={14} />
                      ) : item.badge === "Loan" ? (
                        <Landmark size={14} />
                      ) : item.badge === "Tag" ? (
                        <TagIcon size={14} />
                      ) : item.badge === "Account" ? (
                        <Wallet size={14} />
                      ) : null;

                    return (
                      <Group key={item.id} gap="xs" align="stretch" wrap="nowrap">
                        {icon ? (
                          <Paper
                            withBorder
                            radius="md"
                            p="xs"
                            style={{
                              alignSelf: "stretch",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 38,
                              background: "var(--surface-alt)",
                            }}
                          >
                            {icon}
                          </Paper>
                        ) : null}
                        <div style={{ flex: 1 }}>
                          <SearchResultCard {...item} />
                        </div>
                      </Group>
                    );
                  })}
                </Stack>
              ) : null}

              {showTransactions ? (
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text fw={600}>Transactions</Text>
                    <Badge variant="light" color="blue">
                      {transactionCount}
                    </Badge>
                  </Group>
                  {filteredTransactions.slice(0, transactionPreviewCount).map((item) => {
                    const { tx, categoryName, accountName } = item;
                    const isExpense = tx.type === "expense";
                    const label = isReimbursement(tx) ? "Reimbursement" : tx.type;
                    const counterpartyLabel = getTransactionCounterpartyName(tx);
                    const transactionQueryLabel =
                      counterpartyLabel ||
                      tx.notes?.trim() ||
                      categoryName ||
                      tx.amount.toString();
                    return (
                      <Paper
                        key={tx.id}
                        withBorder
                        radius="md"
                        p="sm"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigateToTransaction(tx.date, {
                            q: transactionQueryLabel,
                            account: tx.account_id ?? undefined,
                            from: tx.date,
                            to: tx.date,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateToTransaction(tx.date, {
                              q: transactionQueryLabel,
                              account: tx.account_id ?? undefined,
                              from: tx.date,
                              to: tx.date,
                            });
                          }
                        }}
                        style={{
                          background: "var(--surface-alt)",
                          cursor: "pointer",
                        }}
                      >
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" align="center" wrap="wrap">
                              <Badge variant="light" color={isExpense ? "red" : "teal"}>
                                {label}
                              </Badge>
                              <Text size="sm" fw={600} lineClamp={1}>
                                {categoryName}
                              </Text>
                            </Group>
                            {counterpartyLabel ? (
                              <Text size="xs" fw={500} c="dimmed" lineClamp={1}>
                                {counterpartyLabel}
                              </Text>
                            ) : null}
                            <Group gap="xs" align="center" wrap="wrap">
                              <Text size="xs" c="dimmed">
                                {dayjs(tx.date).format("DD MMM YYYY")}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {accountName}
                              </Text>
                              {(tx.tags ?? []).slice(0, 2).map((tagItem) => (
                                <Badge key={tagItem.id} variant="light" color="blue">
                                  {tagItem.name}
                                </Badge>
                              ))}
                            </Group>
                          </Stack>
                          <Stack gap={4} align="flex-end">
                            <Text fw={700} c={isExpense ? "red.7" : "teal.7"}>
                              {isExpense ? "-" : "+"}
                              {formatINR(
                                tx.amount,
                                tx.account_id
                                  ? accountCurrencyMap.get(tx.account_id) ?? null
                                  : tx.currency ?? null
                              )}
                            </Text>
                            <ArrowUpRight size={14} />
                          </Stack>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : null}

              {scope !== "transactions" ? (
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text fw={600}>Subscriptions</Text>
                    <Badge variant="light" color="blue">
                      {subscriptionCount}
                    </Badge>
                  </Group>
                  {filteredSubscriptions.slice(0, subscriptionPreviewCount).map((item) => {
                    const { sub, accountName, categoryName } = item;
                    return (
                      <Paper
                        key={sub.id}
                        withBorder
                        radius="md"
                        p="sm"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigateTo(appPath("/subscriptions"), {
                            q: sub.name,
                            status: sub.status,
                            account: sub.account_id ?? undefined,
                            from: sub.next_due,
                            to: sub.next_due,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateTo(appPath("/subscriptions"), {
                              q: sub.name,
                              status: sub.status,
                              account: sub.account_id ?? undefined,
                              from: sub.next_due,
                              to: sub.next_due,
                            });
                          }
                        }}
                        style={{
                          background: "var(--surface-alt)",
                          cursor: "pointer",
                        }}
                      >
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" align="center" wrap="wrap">
                              <Badge variant="light" color="indigo">
                                {sub.status}
                              </Badge>
                              <Text size="sm" fw={600} lineClamp={1}>
                                {sub.name}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {categoryName}
                            </Text>
                            <Group gap="xs" align="center" wrap="wrap">
                              <Text size="xs" c="dimmed">
                                Next: {dayjs(sub.next_due).format("DD MMM YYYY")}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {accountName}
                              </Text>
                              {isForeignCurrencySubscription(sub) ? (
                                <Text size="xs" c="dimmed">
                                  {getSubscriptionNativeAmountLabel(sub)}
                                </Text>
                              ) : null}
                            </Group>
                          </Stack>
                          <Stack gap={4} align="flex-end">
                            <Text fw={700}>{getSubscriptionPlanningAmountLabel(sub)}</Text>
                            <ArrowUpRight size={14} />
                          </Stack>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : null}
            </Stack>
          </ScrollArea>
        )}
      </Stack>
    </Drawer>
  );
};
