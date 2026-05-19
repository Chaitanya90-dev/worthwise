import { Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import dayjs from "dayjs";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "../../lib/format";
import type { FundContribution } from "../../types/finance";
import { chartPalette } from "../../theme";

type FundContributionChartProps = {
  contributions: FundContribution[];
};

export const FundContributionChart = ({
  contributions,
}: FundContributionChartProps) => {
  const { monthlyData, fundKeys } = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; sortKey: number; totals: Record<string, number> }
    >();
    const fundSet = new Set<string>();

    contributions.forEach((item) => {
      const date = dayjs(item.date);
      const key = date.format("YYYY-MM");
      const fundKey = item.fund_name ?? "Fund";
      fundSet.add(fundKey);
      const entry = buckets.get(key) ?? {
        label: date.format("MMM YY"),
        sortKey: date.valueOf(),
        totals: {},
      };
      entry.totals[fundKey] = (entry.totals[fundKey] ?? 0) + item.amount;
      buckets.set(key, entry);
    });

    const rows = Array.from(buckets.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-6)
      .map((entry) => ({ label: entry.label, ...entry.totals }));

    const keys = Array.from(fundSet.values()).sort();
    return { monthlyData: rows, fundKeys: keys };
  }, [contributions]);

  const colorForIndex = (index: number) =>
    chartPalette.categorical[index % chartPalette.categorical.length];

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Title order={4}>Monthly contributions</Title>
        <Text size="sm" c="dimmed">
          Last six months of contributions.
        </Text>
      </Stack>
      {monthlyData.length === 0 ? (
        <Text size="sm" c="dimmed">
          Add contributions to see the trend.
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={monthlyData}
            margin={{ top: 8, right: 12, left: 12, bottom: 4 }}
            barCategoryGap="30%"
            barGap={8}
          >
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => formatINR(Number(value))} />
            <Legend verticalAlign="top" height={32} />
            {fundKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="funds"
                fill={colorForIndex(index)}
                radius={index === fundKeys.length - 1 ? [6, 6, 0, 0] : undefined}
                barSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};
