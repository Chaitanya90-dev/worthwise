import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../DatatrixTable";
import { formatINR } from "../../lib/format";
import type { FundProjection } from "../../lib/fundInsights";

type ProjectionRow = {
  id: string;
  fund: string;
  progress: string;
  remaining: number;
  monthly: number | null;
  projected: string;
  target: string;
  required: number | null;
  status: string;
};

type FundProjectionTableProps = {
  projections: FundProjection[];
  loading: boolean;
};

export const FundProjectionTable = ({
  projections,
  loading,
}: FundProjectionTableProps) => {
  const rows = useMemo<ProjectionRow[]>(
    () =>
      projections.map((projection) => ({
        id: projection.id,
        fund: projection.name,
        progress: `${projection.progress}%`,
        remaining: projection.remaining,
        monthly: projection.monthlyContribution,
        projected: projection.projectedDateLabel,
        target: projection.targetDateLabel ?? "-",
        required: projection.requiredMonthly,
        status: projection.status,
      })),
    [projections]
  );

  const columns = useMemo<ColDef<ProjectionRow>[]>(
    () => [
      { headerName: "Fund", field: "fund", flex: 1.3 },
      { headerName: "Progress", field: "progress", maxWidth: 120 },
      {
        headerName: "Remaining",
        field: "remaining",
        maxWidth: 150,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Monthly",
        field: "monthly",
        maxWidth: 140,
        valueFormatter: (params) =>
          params.value ? formatINR(Number(params.value)) : "-",
      },
      {
        headerName: "Projected finish",
        field: "projected",
        maxWidth: 160,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Target date",
        field: "target",
        maxWidth: 150,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Required/mo",
        field: "required",
        maxWidth: 150,
        valueFormatter: (params) =>
          params.value ? formatINR(Number(params.value)) : "-",
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 150,
        cellClass: (params) => {
          switch (params.value) {
            case "Goal met":
            case "On track":
              return "datatrix-cell-positive";
            case "Behind schedule":
              return "datatrix-cell-negative";
            case "No monthly plan":
              return "datatrix-cell-muted";
            default:
              return undefined;
          }
        },
      },
    ],
    []
  );

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Group justify="space-between" align="center" mb="md">
        <Stack gap={2}>
          <Title order={4}>Projections</Title>
          <Text size="sm" c="dimmed">
            Estimated completion and pace guidance per fund.
          </Text>
        </Stack>
        <Badge variant="light" color="blue">
          {projections.length} funds
        </Badge>
      </Group>
      <DatatrixTable
        rows={rows}
        columns={columns}
        height={320}
        emptyLabel="Create a fund to see projections."
        loading={loading}
      />
    </Paper>
  );
};
