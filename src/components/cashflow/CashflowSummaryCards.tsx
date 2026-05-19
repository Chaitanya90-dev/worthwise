import { Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";

type CashflowSummaryCardsProps = {
  totalIncome: number;
  totalExpense: number;
  net: number;
  incomeCount: number;
  expenseCount: number;
  savingsRate: number | null;
};

export const CashflowSummaryCards = ({
  totalIncome,
  totalExpense,
  net,
  incomeCount,
  expenseCount,
  savingsRate,
}: CashflowSummaryCardsProps) => (
  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Income
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totalIncome)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        {incomeCount} income entries
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Expenses
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totalExpense)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        {expenseCount} expense entries
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Net cashflow
      </Text>
      <Title order={3} mt="xs" c={net >= 0 ? "green.6" : "red.6"}>
        {formatINR(net)}
      </Title>
      <Text size="sm" fw={600} c={net >= 0 ? "green.6" : "red.6"}>
        {savingsRate === null ? "No income yet" : `${savingsRate}% savings rate`}
      </Text>
    </Paper>
  </SimpleGrid>
);
