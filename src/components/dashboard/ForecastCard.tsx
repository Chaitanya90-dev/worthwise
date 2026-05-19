import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import { formatINR } from "../../lib/format";

type ForecastCardProps = {
  cashOnHand: number;
  avgDailySpend: number;
  recurringIncome: number;
  recurringExpense: number;
  forecast30: number;
  forecast60: number;
  minBalance: number;
  minBalanceDate: string | null;
  firstNegativeDate: string | null;
  style?: React.CSSProperties;
};

export const ForecastCard = ({
  cashOnHand,
  avgDailySpend,
  recurringIncome,
  recurringExpense,
  forecast30,
  forecast60,
  minBalance,
  minBalanceDate,
  firstNegativeDate,
  style,
}: ForecastCardProps) => {
  const netRecurring = recurringIncome - recurringExpense;
  const runwayDays = avgDailySpend > 0 ? Math.max(0, Math.floor(cashOnHand / avgDailySpend)) : 0;
  const bufferTarget = avgDailySpend * 7;
  const hasNegative = Boolean(firstNegativeDate);
  const belowBuffer = !hasNegative && bufferTarget > 0 && minBalance < bufferTarget;
  const minDateLabel = minBalanceDate ? dayjs(minBalanceDate).format("DD MMM") : "N/A";
  const alertLabel = hasNegative
    ? `Balance below 0 on ${dayjs(firstNegativeDate).format("DD MMM")}`
    : belowBuffer
      ? `Balance below 7-day buffer on ${minDateLabel}`
      : "No cash dips expected in 60 days";

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Title order={4} mb={4}>
        Cash runway
      </Title>
      <Text size="sm" c="dimmed" mb="xs">
        30/60-day forecast with recurring bills
      </Text>
      <Stack gap={8}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Runway (avg daily spend)
          </Text>
          <Text fw={700}>{runwayDays} days</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Projected balance (30 days)
          </Text>
          <Text fw={700} c={forecast30 >= 0 ? "teal.7" : "red.7"}>
            {formatINR(forecast30)}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Projected balance (60 days)
          </Text>
          <Text fw={700} c={forecast60 >= 0 ? "teal.7" : "red.7"}>
            {formatINR(forecast60)}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Lowest balance
          </Text>
          <Text fw={700} c={minBalance >= 0 ? "teal.7" : "red.7"}>
            {formatINR(minBalance)} · {minDateLabel}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Recurring income
          </Text>
          <Text fw={700}>{formatINR(recurringIncome)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Recurring expense
          </Text>
          <Text fw={700}>{formatINR(recurringExpense)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Net recurring
          </Text>
          <Text fw={700} c={netRecurring >= 0 ? "teal.7" : "red.7"}>
            {netRecurring >= 0 ? "+" : "-"}
            {formatINR(Math.abs(netRecurring))}
          </Text>
        </Group>
        <Badge
          variant="light"
          color={hasNegative ? "red" : belowBuffer ? "yellow" : "teal"}
          radius="sm"
        >
          {alertLabel}
        </Badge>
      </Stack>
    </Paper>
  );
};
