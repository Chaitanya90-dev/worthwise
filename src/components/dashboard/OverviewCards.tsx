import { Paper, SimpleGrid, Text, Title, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";
import { formatINR } from "../../lib/format";

type OverviewCardsProps = {
  monthLabel: string;
  transactionCount: number;
  totalSpent: number;
  totalBudget: number;
  remaining: number;
  previousTransactionCount?: number;
  previousTotalSpent?: number;
  previousTotalBudget?: number;
  hasPreviousMonthData?: boolean;
};

export const OverviewCards = ({
  monthLabel,
  transactionCount,
  totalSpent,
  totalBudget,
  remaining,
  previousTransactionCount,
  previousTotalSpent,
  previousTotalBudget,
  hasPreviousMonthData = false,
}: OverviewCardsProps) => {
  const transactionDelta =
    previousTransactionCount === undefined
      ? null
      : transactionCount - previousTransactionCount;
  const spentDelta =
    previousTotalSpent === undefined ? null : totalSpent - previousTotalSpent;
  const budgetDelta =
    previousTotalBudget === undefined
      ? null
      : totalBudget - previousTotalBudget;
  let transactionDeltaColor = "dimmed";
  let spentDeltaColor = "dimmed";
  let budgetDeltaColor = "dimmed";

  if (hasPreviousMonthData && transactionDelta !== null) {
    if (transactionDelta > 0) {
      transactionDeltaColor = "brand.6";
    } else if (transactionDelta < 0) {
      transactionDeltaColor = "orange.6";
    }
  }

  if (hasPreviousMonthData && spentDelta !== null) {
    if (spentDelta > 0) {
      spentDeltaColor = "red.6";
    } else if (spentDelta < 0) {
      spentDeltaColor = "teal.6";
    }
  }

  if (hasPreviousMonthData && budgetDelta !== null) {
    if (budgetDelta > 0) {
      budgetDeltaColor = "teal.6";
    } else if (budgetDelta < 0) {
      budgetDeltaColor = "orange.6";
    }
  }

  const getDeltaLabel = (
    delta: number | null,
    formatter: (value: number) => string
  ) => {
    if (!hasPreviousMonthData || delta === null) {
      return "No prior data";
    }
    if (delta === 0) {
      return "No change vs last month";
    }
    const sign = delta > 0 ? "+" : "-";
    return `${sign}${formatter(Math.abs(delta))} vs last month`;
  };

  const wrapTooltip = (label: string, content: ReactNode) =>
    label === "No prior data" ? (
      content
    ) : (
      <Tooltip label={label} withArrow>
        <div>{content}</div>
      </Tooltip>
    );

  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Text size="sm" c="dimmed">
          Month
        </Text>
        <Title order={3} mt="xs">
          {monthLabel}
        </Title>
        <Text size="sm" c="brand.6" fw={600}>
          {transactionCount} transactions
        </Text>
        {wrapTooltip(
          hasPreviousMonthData && previousTransactionCount !== undefined
            ? `Last month: ${previousTransactionCount} transactions`
            : "No prior data",
          <Text size="xs" c={transactionDeltaColor} fw={600}>
            {getDeltaLabel(transactionDelta, String)}
          </Text>
        )}
      </Paper>
      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Text size="sm" c="dimmed">
          Spent
        </Text>
        <Title order={3} mt="xs">
          {formatINR(totalSpent)}
        </Title>
        <Text size="sm" c="dimmed" fw={500}>
          Month-to-date spend
        </Text>
        {wrapTooltip(
          hasPreviousMonthData && previousTotalSpent !== undefined
            ? `Last month: ${formatINR(previousTotalSpent)}`
            : "No prior data",
          <Text size="xs" c={spentDeltaColor} fw={600}>
            {getDeltaLabel(spentDelta, formatINR)}
          </Text>
        )}
      </Paper>
      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Text size="sm" c="dimmed">
          Budget
        </Text>
        <Title order={3} mt="xs">
          {formatINR(totalBudget)}
        </Title>
        <Text size="sm" c={remaining < 0 ? "red.6" : "brand.6"} fw={600}>
          {remaining < 0
            ? `${formatINR(Math.abs(remaining))} over`
            : `${formatINR(remaining)} left`}
        </Text>
        {wrapTooltip(
          hasPreviousMonthData && previousTotalBudget !== undefined
            ? `Last month: ${formatINR(previousTotalBudget)}`
            : "No prior data",
          <Text size="xs" c={budgetDeltaColor} fw={600}>
            {getDeltaLabel(budgetDelta, formatINR)}
          </Text>
        )}
      </Paper>
    </SimpleGrid>
  );
};
