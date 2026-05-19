import { Group, Paper, Select, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../DatatrixTable";
import { formatINR } from "../../lib/format";
import type { Fund, FundContribution } from "../../types/finance";

type FundContributionTableProps = {
  funds: Fund[];
  contributions: FundContribution[];
  loading: boolean;
  onEditContribution: (id: string) => void;
  readOnly?: boolean;
};

export const FundContributionTable = ({
  funds,
  contributions,
  loading,
  onEditContribution,
  readOnly = false,
}: FundContributionTableProps) => {
  const [contributionFilter, setContributionFilter] = useState<string>("");

  const fundOptions = useMemo(
    () => funds.map((fund) => ({ value: fund.id, label: fund.name })),
    [funds]
  );
  const fundNameMap = useMemo(
    () => new Map(funds.map((fund) => [fund.id, fund.name])),
    [funds]
  );

  const filteredContributions = useMemo(
    () =>
      contributionFilter
        ? contributions.filter((item) => item.fund_id === contributionFilter)
        : contributions,
    [contributions, contributionFilter]
  );

  const contributionRows = useMemo(
    () =>
      filteredContributions.map((item) => ({
        id: item.id,
        date: dayjs(item.date).format("DD MMM YYYY"),
        fund: item.fund_name ?? fundNameMap.get(item.fund_id) ?? "-",
        note: item.note ?? "-",
        type: item.amount < 0 ? "Withdrawal" : "Deposit",
        amount: item.amount,
      })),
    [filteredContributions, fundNameMap]
  );

  const contributionColumns = useMemo<ColDef<(typeof contributionRows)[number]>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 140 },
      { headerName: "Fund", field: "fund", flex: 1.1 },
      { headerName: "Type", field: "type", maxWidth: 140 },
      {
        headerName: "Note",
        field: "note",
        flex: 1.6,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 160,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
        cellClass: (params) =>
          Number(params.value ?? 0) < 0
            ? "datatrix-cell-negative"
            : "datatrix-cell-positive",
      },
    ],
    []
  );

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Group justify="space-between" align="center" mb="md">
        <Stack gap={2}>
          <Title order={4}>Contribution history</Title>
          <Text size="sm" c="dimmed">
            Track every deposit or withdrawal by fund.
          </Text>
          <Text size="xs" c="dimmed">
            Click a row to edit or delete.
          </Text>
        </Stack>
        <Select
          placeholder="All funds"
          data={fundOptions}
          value={contributionFilter || null}
          onChange={(value) => setContributionFilter(value ?? "")}
          clearable
          size="xs"
          w={180}
        />
      </Group>
      <DatatrixTable
        rows={contributionRows}
        columns={contributionColumns}
        height={320}
        emptyLabel="No contributions logged yet."
        loading={loading}
        getRowId={(row) => row.id}
        onRowClick={(row) => {
          if (!readOnly) {
            onEditContribution(row.id);
          }
        }}
      />
    </Paper>
  );
};
