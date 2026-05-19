import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";

type NetCashflowCardProps = {
  income: number;
  expense: number;
  style?: React.CSSProperties;
};

export const NetCashflowCard = ({ income, expense, style }: NetCashflowCardProps) => {
  const net = income - expense;
  const netColor = net >= 0 ? "teal.7" : "red.7";

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Title order={4} mb={4}>
        Net cashflow
      </Title>
      <Text size="sm" c="dimmed" mb="xs">
        This month’s inflow vs outflow
      </Text>
      <Stack gap={8}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Income
          </Text>
          <Text fw={700}>{formatINR(income)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Expense
          </Text>
          <Text fw={700}>{formatINR(expense)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Net
          </Text>
          <Text fw={700} c={netColor}>
            {net >= 0 ? "+" : "-"}
            {formatINR(Math.abs(net))}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
};
