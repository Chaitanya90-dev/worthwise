import { Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../DatatrixTable";
import { formatINR } from "../../lib/format";

type CategoryRow = {
  id: string;
  category: string;
  amount: number;
  share: number;
};

type CategoryTableProps = {
  title: string;
  subtitle: string;
  rows: CategoryRow[];
  emptyLabel: string;
  loading: boolean;
  amountClass: string;
};

const CategoryTable = ({
  title,
  subtitle,
  rows,
  emptyLabel,
  loading,
  amountClass,
}: CategoryTableProps) => {
  const columns = useMemo<ColDef<CategoryRow>[]>(
    () => [
      { headerName: "Category", field: "category", flex: 1.4 },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 160,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
        cellClass: amountClass,
      },
      {
        headerName: "Share",
        field: "share",
        maxWidth: 120,
        valueFormatter: (params) => `${params.value ?? 0}%`,
      },
    ],
    [amountClass]
  );

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Title order={4}>{title}</Title>
        <Text size="sm" c="dimmed">
          {subtitle}
        </Text>
      </Stack>
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyLabel}
        </Text>
      ) : (
        <DatatrixTable
          rows={rows}
          columns={columns}
          emptyLabel={emptyLabel}
          loading={loading}
        />
      )}
    </Paper>
  );
};

type CashflowCategoryTablesProps = {
  expenseRows: CategoryRow[];
  incomeRows: CategoryRow[];
  isLoading: boolean;
};

export const CashflowCategoryTables = ({
  expenseRows,
  incomeRows,
  isLoading,
}: CashflowCategoryTablesProps) => (
  <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
    <CategoryTable
      title="Top expense categories"
      subtitle="Where money leaves"
      rows={expenseRows}
      emptyLabel="No expenses recorded."
      loading={isLoading}
      amountClass="datatrix-cell-negative"
    />
    <CategoryTable
      title="Top income categories"
      subtitle="Where money comes in"
      rows={incomeRows}
      emptyLabel="No income recorded."
      loading={isLoading}
      amountClass="datatrix-cell-positive"
    />
  </SimpleGrid>
);
