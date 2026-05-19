import { Badge, Paper, SimpleGrid, Text, Title } from "@mantine/core";
import type { ChangeSummary } from "../../lib/reports";
import { formatINR } from "../../lib/format";

type ReportSummaryCardsProps = {
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  prevRangeLabel: string;
  incomeChange: ChangeSummary;
  expenseChange: ChangeSummary;
};

export const ReportSummaryCards = ({
  incomeTotal,
  expenseTotal,
  netTotal,
  prevRangeLabel,
  incomeChange,
  expenseChange,
}: ReportSummaryCardsProps) => (
  <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Income
      </Text>
      <Title order={3}>{formatINR(incomeTotal)}</Title>
      <Badge variant="light" color={incomeChange.color}>
        {incomeChange.label} vs previous
      </Badge>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Expenses
      </Text>
      <Title order={3}>{formatINR(expenseTotal)}</Title>
      <Badge variant="light" color={expenseChange.color}>
        {expenseChange.label} vs previous
      </Badge>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Net
      </Text>
      <Title order={3}>{formatINR(netTotal)}</Title>
      <Text size="sm" c="dimmed">
        {netTotal >= 0 ? "Surplus" : "Deficit"}
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Previous range
      </Text>
      <Title order={4}>{prevRangeLabel}</Title>
      <Text size="sm" c="dimmed">
        Used for MoM comparison
      </Text>
    </Paper>
  </SimpleGrid>
);
