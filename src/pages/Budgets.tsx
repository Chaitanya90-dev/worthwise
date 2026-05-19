import {
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Copy, Layers, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import {
  useGetBudgetsQuery,
  useGetCategoriesQuery,
  useUpsertBudgetsMutation,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { formatINR, formatMonthLabel } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { BudgetDeleteModal } from "../components/budgets/BudgetDeleteModal";
import { BudgetFormModal } from "../components/budgets/BudgetFormModal";
import { BudgetBulkModal } from "../components/budgets/BudgetBulkModal";
import { PageActionMenu } from "../components/common/PageActionMenu";
import { EmptyState } from "../components/common/EmptyState";
import { PageStatusChips } from "../components/common/PageStatusChips";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { Budget, Transaction } from "../types/finance";
import { useAppMonth } from "../context/AppMonthContext";
import { useReadOnly } from "../context/ReadOnlyContext";
import { getNetExpenseCategoryKey, getNetExpenseDelta } from "../lib/transactions";

const buildSpendMap = (transactions: Transaction[]) => {
  const map = new Map<string, number>();
  let overall = 0;
  transactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    const key = getNetExpenseCategoryKey(tx);
    if (key) {
      map.set(key, (map.get(key) ?? 0) + delta);
    }
    overall += delta;
  });
  map.set("overall", overall);
  return map;
};

const getBudgetKey = (categoryId: string | null) => categoryId ?? "overall";

const getBudgetSpend = (map: Map<string, number>, categoryId: string | null) =>
  Math.max(0, map.get(getBudgetKey(categoryId)) ?? 0);

type BudgetRow = {
  id: string;
  category: string;
  planned: number;
  actual: number;
  rollover: number;
  available: number;
  ratio: number;
  status: "over" | "near" | "ok" | "none";
  rolloverEnabled: boolean;
};

const BudgetAllocationCell = (params: ICellRendererParams<BudgetRow>) => {
  const planned = params.data?.planned ?? 0;
  const actual = params.data?.actual ?? 0;
  const rollover = params.data?.rollover ?? 0;
  const available = params.data?.available ?? 0;
  const ratio = params.data?.ratio ?? 0;
  const status = params.data?.status ?? "ok";
  const rolloverEnabled = params.data?.rolloverEnabled ?? false;
  const hasAllocation = planned !== 0 || rollover !== 0;
  let color = "teal";
  let helper = "Within budget";
  if (!hasAllocation && actual > 0) {
    color = "red";
    helper = "No budget set";
  } else if (!hasAllocation) {
    color = "gray";
    helper = "No allocation";
  } else if (status === "over") {
    color = "red";
    helper = "Over budget";
  } else if (status === "near") {
    color = "orange";
    helper = "Near limit";
  }

  const progressValue = Math.min(100, Math.max(0, Math.round((ratio || 0) * 100)));
  const rolloverLabel =
    rollover > 0 ? `+${formatINR(rollover)}` : formatINR(rollover);
  return (
    <Stack gap="xs" style={{ width: "100%" }}>
      <SimpleGrid cols={3} spacing="lg">
        <Text size="xs" c="dimmed">
          Planned
        </Text>
        <Text size="xs" c="dimmed">
          Actual
        </Text>
        <Text size="xs" c="dimmed" ta="right">
          Available
        </Text>
      </SimpleGrid>
      <SimpleGrid cols={3} spacing="lg">
        <Text size="sm" fw={600}>
          {formatINR(planned)}
        </Text>
        <Text size="sm" fw={600}>
          {formatINR(actual)}
        </Text>
        <Text
          size="sm"
          fw={600}
          c={available < 0 ? "red.6" : "dimmed"}
          ta="right"
        >
          {formatINR(available)}
        </Text>
      </SimpleGrid>
      {rolloverEnabled ? (
        <Text size="xs" c="dimmed">
          Carryover from last month: {rolloverLabel}
        </Text>
      ) : null}
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Progress
          value={progressValue}
          color={color}
          size="sm"
          radius="xl"
          style={{ flex: 1 }}
        />
      </Group>
      <Text size="xs" c="dimmed">
        {helper}
      </Text>
    </Stack>
  );
};

export const Budgets = () => {
  const { month } = useAppMonth();
  const isReadOnly = useReadOnly();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [copying, setCopying] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: budgets = [], isLoading: isBudgetsLoading } =
    useGetBudgetsQuery(month);
  const { data: transactions = [] } = useGetTransactionsQuery({ month });
  const prevMonth = dayjs(month + "-01")
    .subtract(1, "month")
    .format("YYYY-MM");
  const { data: prevBudgets = [] } = useGetBudgetsQuery(prevMonth);
  const { data: prevTransactions = [] } = useGetTransactionsQuery({
    month: prevMonth,
  });
  const [upsertBudgets] = useUpsertBudgetsMutation();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const budgetMap = useMemo(
    () => new Map(budgets.map((budget) => [budget.id, budget])),
    [budgets]
  );
  const takenCategoryIds = useMemo(
    () =>
      new Set(
        budgets
          .filter((budget) => budget.category_id)
          .map((budget) => budget.category_id as string)
      ),
    [budgets]
  );
  const hasOverallBudget = useMemo(
    () => budgets.some((budget) => !budget.category_id),
    [budgets]
  );

  const total = useMemo(
    () => budgets.reduce((sum, budget) => sum + budget.amount, 0),
    [budgets]
  );
  const spendMap = useMemo(() => buildSpendMap(transactions), [transactions]);
  const prevSpendMap = useMemo(
    () => buildSpendMap(prevTransactions),
    [prevTransactions]
  );
  const prevBudgetMap = useMemo(() => {
    const map = new Map<string, Budget>();
    prevBudgets.forEach((budget) => {
      map.set(getBudgetKey(budget.category_id), budget);
    });
    return map;
  }, [prevBudgets]);
  const rows = useMemo<BudgetRow[]>(
    () =>
      budgets.map((budget) => {
        const key = getBudgetKey(budget.category_id);
        const actual = getBudgetSpend(spendMap, budget.category_id);
        const rolloverEnabled = Boolean(budget.rollover_enabled);
        let rollover = 0;
        if (rolloverEnabled) {
          const prevBudget = prevBudgetMap.get(key);
          if (prevBudget) {
            const prevSpend = getBudgetSpend(prevSpendMap, prevBudget.category_id);
            rollover = prevBudget.amount - prevSpend;
          }
        }
        const planned = budget.amount;
        const total = planned + rollover;
        const available = total - actual;
        let ratio = 0;
        if (total > 0) {
          ratio = actual / total;
        } else if (actual > 0) {
          ratio = 1;
        }
        let status: BudgetRow["status"] = "ok";
        if (total <= 0) {
          status =
            planned === 0 && rollover === 0 && actual === 0 ? "none" : "over";
        } else if (ratio > 1) {
          status = "over";
        } else if (ratio >= 0.85) {
          status = "near";
        }

        return {
          id: budget.id,
          category: categoryMap.get(budget.category_id ?? "") ?? "Overall",
          planned,
          actual,
          rollover,
          available,
          ratio,
          status,
          rolloverEnabled,
        };
      }),
    [budgets, categoryMap, prevBudgetMap, prevSpendMap, spendMap]
  );

  const columns = useMemo<ColDef<BudgetRow>[]>(
    () => [
      { headerName: "Category", field: "category", flex: 1.2 },
      {
        headerName: "Planned vs actual",
        field: "planned",
        flex: 2,
        cellRenderer: BudgetAllocationCell,
        cellClass: "datatrix-cell-top datatrix-cell-wrap",
      },
    ],
    []
  );

  const selectedBudget = editingBudgetId
    ? budgetMap.get(editingBudgetId) ?? null
    : null;
  const nearLimitCount = useMemo(
    () => rows.filter((row) => row.status === "near").length,
    [rows]
  );
  const overBudgetCount = useMemo(
    () => rows.filter((row) => row.status === "over").length,
    [rows]
  );
  const budgetStatusChips = useMemo(
    () => [
      {
        id: "budgets",
        label: `${rows.length} budgets`,
        color: "blue",
        tooltip: "Budget rows configured for this month.",
      },
      {
        id: "near",
        label: `${nearLimitCount} near limit`,
        color: nearLimitCount > 0 ? "orange" : "gray",
        tooltip: "Budgets currently above the 85% warning threshold.",
      },
      {
        id: "over",
        label: `${overBudgetCount} over`,
        color: overBudgetCount > 0 ? "red" : "gray",
        tooltip: "Budgets where actual spend exceeds available allocation.",
      },
    ],
    [nearLimitCount, overBudgetCount, rows.length]
  );

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) {
      return;
    }
    if (action === "new") {
      setEditingBudgetId(null);
      setIsFormOpen(true);
    } else if (action === "bulk") {
      setIsBulkOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleOpenCreate = () => {
    if (isReadOnly) {
      return;
    }
    setEditingBudgetId(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBudgetId(null);
  };

  const handleEditBudget = (id: string) => {
    if (isReadOnly) {
      return;
    }
    setEditingBudgetId(id);
    setIsFormOpen(true);
  };

  const handleRequestDelete = () => {
    if (isReadOnly) {
      return;
    }
    if (!selectedBudget) {
      return;
    }
    setDeleteTarget(selectedBudget);
    setIsFormOpen(false);
    setEditingBudgetId(null);
  };

  const deleteCategoryName = deleteTarget?.category_id
    ? categoryMap.get(deleteTarget.category_id) ?? "this category"
    : "Overall";

  const handleCopyPrevMonth = async () => {
    if (isReadOnly) {
      return;
    }
    if (copying) return;
    setCopying(true);
    try {
      const existingKeys = new Set(
        budgets.map((b) => `${b.category_id ?? "overall"}`)
      );
      const items = prevBudgets
        .filter((b) => !existingKeys.has(`${b.category_id ?? "overall"}`))
        .map((b) => ({
          category_id: b.category_id,
          amount: b.amount,
          rollover_enabled: b.rollover_enabled,
        }));
      if (items.length === 0) {
        setCopying(false);
        return;
      }
      await upsertBudgets({ month, items }).unwrap();
    } finally {
      setCopying(false);
    }
  };

  const formKey = `${selectedBudget?.id ?? "new"}-${
    isFormOpen ? "open" : "closed"
  }`;
  const deleteKey = `delete-${deleteTarget?.id ?? "none"}-${
    deleteTarget ? "open" : "closed"
  }`;
  const budgetOverflowActions = [
    {
      label: "Copy last month",
      icon: <Copy size={16} strokeWidth={2} />,
      onClick: handleCopyPrevMonth,
      disabled: copying || prevBudgets.length === 0 || isReadOnly,
    },
    {
      label: "Bulk add",
      icon: <Layers size={16} strokeWidth={2} />,
      onClick: () => setIsBulkOpen(true),
      disabled: isReadOnly,
    },
  ];

  return (
    <Stack gap="lg">
      <BudgetFormModal
        key={formKey}
        opened={isFormOpen}
        onClose={handleCloseForm}
        month={month}
        categories={categories}
        budget={selectedBudget}
        takenCategoryIds={takenCategoryIds}
        hasOverallBudget={hasOverallBudget}
        onRequestDelete={handleRequestDelete}
        readOnly={isReadOnly}
      />
      <BudgetDeleteModal
        key={deleteKey}
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        budget={deleteTarget}
        categoryName={deleteCategoryName}
      />
      <BudgetBulkModal
        opened={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        month={month}
        categories={categories}
        budgets={budgets}
        readOnly={isReadOnly}
      />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>{formatMonthLabel(month)}</Title>
            <Text size="sm" c="dimmed">
              Total planned: {formatINR(total)}
            </Text>
            <PageStatusChips items={budgetStatusChips} />
            <Text size="xs" c="dimmed">
              Click a row to edit or delete.
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <PageActionMenu items={budgetOverflowActions} />
            <Button
              leftSection={<Plus size={16} strokeWidth={2} />}
              onClick={handleOpenCreate}
              disabled={isReadOnly}
            >
              Set budget
            </Button>
          </Group>
        </Group>
        {rows.length === 0 && !isBudgetsLoading ? (
          <EmptyState
            title="No budgets set yet"
            description={
              prevBudgets.length > 0
                ? "Start fresh for this month or copy last month to reuse your allocations and alerts."
                : "Set your first budget to unlock category guardrails, soft-cap alerts, and monthly planning."
            }
            action={
              isReadOnly
                ? undefined
                : {
                    label: "Set budget",
                    onClick: handleOpenCreate,
                  }
            }
          />
        ) : (
          <DatatrixTable
            rows={rows}
            columns={columns}
            emptyLabel="No budgets set for this month."
            loading={isBudgetsLoading}
            getRowId={(row) => row.id}
            onRowClick={(row) => handleEditBudget(row.id)}
            rowHeight={120}
          />
        )}
      </Paper>
    </Stack>
  );
};
