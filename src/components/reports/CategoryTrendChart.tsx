import {
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "../../lib/format";
import type { CategoryTrendSeries } from "../../lib/reports";
import { chartPalette } from "../../theme";
import { EmptyState } from "../common/EmptyState";

type CategoryTrendChartProps = {
  data?: Array<Record<string, number | string>>;
  series?: CategoryTrendSeries[];
  mode?: "top" | "all";
  onModeChange?: (mode: "top" | "all") => void;
};

const hasTrendValues = (
  data: Array<Record<string, number | string>>,
  series: CategoryTrendSeries[]
) =>
  data.some((row) =>
    series.some((item) => Number(row[item.key] ?? 0) > 0)
  );

export const CategoryTrendChart = ({
  data = [],
  series = [],
  mode = "top",
  onModeChange,
}: CategoryTrendChartProps) => {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const chartReady =
    series.length > 0 && data.length > 0 && hasTrendValues(data, series);
  const legendItems = series.map((item, index) => ({
    key: item.key,
    label: item.label,
    color:
      chartPalette.categorical[index % chartPalette.categorical.length],
  }));
  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Category trends</Title>
            <Text size="sm" c="dimmed">
              Monthly spend split across {mode === "top" ? "top" : "all"} categories.
            </Text>
          </Stack>
          {onModeChange ? (
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(value) => onModeChange(value as "top" | "all")}
              data={[
                { label: "Top categories", value: "top" },
                { label: "All categories", value: "all" },
              ]}
            />
          ) : null}
        </Group>
      </Stack>
      {chartReady ? (
        <Stack gap="sm">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 12, left: 12, bottom: 4 }}
              barCategoryGap="35%"
              barGap={8}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--stroke)"
              />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => formatINR(Number(value))} />
              {isMobile ? null : <Legend verticalAlign="top" height={32} />}
              {series.map((item, index) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.label}
                  stackId="categories"
                  fill={
                    chartPalette.categorical[
                      index % chartPalette.categorical.length
                    ]
                  }
                  radius={index === series.length - 1 ? [6, 6, 0, 0] : undefined}
                  barSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          {isMobile ? (
            <Group gap="sm" wrap="wrap">
              {legendItems.map((item) => (
                <Group key={item.key} gap={6}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "999px",
                      backgroundColor: item.color,
                      display: "inline-block",
                    }}
                  />
                  <Text size="xs" c="dimmed">
                    {item.label}
                  </Text>
                </Group>
              ))}
            </Group>
          ) : null}
        </Stack>
      ) : (
        <EmptyState description="Add expenses to see category trends over time." />
      )}
    </Paper>
  );
};
