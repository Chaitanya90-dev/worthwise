import { Paper, Stack, Text, Title } from "@mantine/core";
import {
  Bar,
  BarChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "../../lib/format";
import { chartPalette } from "../../theme";

type WeeklyDatum = {
  week: string;
  income: number;
  expense: number;
  net: number;
};

type CashflowWeeklyChartProps = {
  weeklyData: WeeklyDatum[];
  hasData: boolean;
};

export const CashflowWeeklyChart = ({
  weeklyData,
  hasData,
}: CashflowWeeklyChartProps) => (
  <Paper withBorder shadow="sm" radius="lg" p="md">
    <Stack gap="xs" mb="sm">
      <Title order={4}>Cashflow by week</Title>
      <Text size="sm" c="dimmed">
        Income vs expenses (net line)
      </Text>
    </Stack>
    {!hasData ? (
      <Text size="sm" c="dimmed">
        Add transactions to see cashflow trends.
      </Text>
    ) : (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={weeklyData}>
          <XAxis dataKey="week" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => formatINR(Number(value))} />
          <Bar
            dataKey="income"
            fill={chartPalette.cashflow.income}
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="expense"
            fill={chartPalette.cashflow.expense}
            radius={[6, 6, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke={chartPalette.cashflow.net}
            strokeWidth={3}
          />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Paper>
);
