import { Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { appPath } from "../../app/paths";
import { formatINR } from "../../lib/format";
import { chartPalette } from "../../theme";
import { EmptyState } from "../common/EmptyState";

type PieDatum = { name: string; value: number };
type DailyDatum = { day: string; value: number };

type ChartsSectionProps = {
  pieData: PieDatum[];
  dailyData: DailyDatum[];
};

export const ChartsSection = ({ pieData, dailyData }: ChartsSectionProps) => (
  <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Title order={4}>Category split</Title>
        <Text size="sm" c="dimmed">
          Expenses by category
        </Text>
      </Stack>
      {pieData.length === 0 ? (
        <EmptyState
          description="No expenses logged yet. Add a transaction to see the split."
          action={{
            label: "Add transaction",
            to: appPath("/transactions"),
          }}
        />
      ) : (
        <Group align="flex-start" wrap="wrap" gap="md" style={{ width: "100%" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0, maxWidth: "100%" }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}-${entry.name}`}
                      fill={
                        chartPalette.categorical[
                          index % chartPalette.categorical.length
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatINR(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Stack
            gap={8}
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            {pieData.slice(0, 8).map((entry, index) => (
              <Group
                gap={10}
                key={`${entry.name}-${index}`}
                align="center"
                justify="flex-start"
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background:
                      chartPalette.categorical[
                        index % chartPalette.categorical.length
                      ],
                  }}
                />
                <Text size="sm" fw={600} style={{ minWidth: 120 }}>
                  {entry.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatINR(entry.value)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Group>
      )}
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Title order={4}>Daily pulse</Title>
        <Text size="sm" c="dimmed">
          Spending by day
        </Text>
      </Stack>
      {dailyData.length > 0 ? (
        <Text size="xs" c="dimmed" ta="right">
          Daily spend
        </Text>
      ) : null}
      {dailyData.length === 0 ? (
        <EmptyState
          description="Add a few expenses to see the trend."
          action={{
            label: "Add transaction",
            to: appPath("/transactions"),
          }}
        />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={dailyData}
            margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--stroke)"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickMargin={10}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
            />
            <Tooltip formatter={(value) => formatINR(Number(value))} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartPalette.line.primary}
              strokeWidth={3}
              dot={{ r: 4, fill: chartPalette.line.accent }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  </SimpleGrid>
);
