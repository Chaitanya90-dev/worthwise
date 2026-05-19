import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import type { CSSProperties } from "react";
import { formatINR } from "../../lib/format";
import type { CategoryInsightItem, CategoryInsights } from "../../lib/categoryInsights";

type CategoryInsightsCardProps = {
  insights: CategoryInsights;
  comparisonLabel: string;
  style?: CSSProperties;
};

const formatPercent = (value: number | null) => {
  if (value === null) {
    return "New";
  }
  const percent = Math.round(value * 100);
  if (percent === 0) {
    return "0%";
  }
  return `${percent > 0 ? "+" : ""}${percent}%`;
};

const getDeltaColor = (delta: number) => {
  if (delta > 0) {
    return "red.7";
  }
  if (delta < 0) {
    return "teal.7";
  }
  return "dimmed";
};

const getDeltaIcon = (delta: number) => {
  if (delta > 0) {
    return <TrendingUp size={14} />;
  }
  if (delta < 0) {
    return <TrendingDown size={14} />;
  }
  return <AlertTriangle size={14} />;
};

const renderMover = (item: CategoryInsightItem) => {
  const color = getDeltaColor(item.delta);
  return (
    <Group key={item.id} justify="space-between" align="center" wrap="nowrap">
      <Group gap="xs" align="center" wrap="nowrap">
        <Badge variant="light" color={item.delta >= 0 ? "red" : "teal"}>
          {item.delta >= 0 ? "Up" : "Down"}
        </Badge>
        <Text size="sm" lineClamp={1}>
          {item.name}
        </Text>
      </Group>
      <Group gap="xs" align="center" wrap="nowrap">
        <Text size="sm" fw={600} c={color}>
          {item.delta >= 0 ? "+" : "-"}
          {formatINR(Math.abs(item.delta))}
        </Text>
        <Text size="xs" c="dimmed">
          {formatPercent(item.percent)}
        </Text>
      </Group>
    </Group>
  );
};

const renderOutlier = (item: CategoryInsightItem) => {
  const ratioLabel =
    item.ratio && item.ratio > 0 ? `${item.ratio.toFixed(1)}x` : "New";
  return (
    <Group key={item.id} justify="space-between" align="center" wrap="nowrap">
      <Group gap="xs" align="center" wrap="nowrap">
        <Badge variant="light" color="orange">
          Spike
        </Badge>
        <Text size="sm" lineClamp={1}>
          {item.name}
        </Text>
      </Group>
      <Group gap="xs" align="center" wrap="nowrap">
        <Text size="sm" fw={600}>
          {formatINR(item.current)}
        </Text>
        <Text size="xs" c="dimmed">
          {ratioLabel}
        </Text>
      </Group>
    </Group>
  );
};

export const CategoryInsightsCard = ({
  insights,
  comparisonLabel,
  style,
}: CategoryInsightsCardProps) => {
  const { totalDelta, totalPercent, movers, outliers, totalCurrent } = insights;
  const deltaColor = getDeltaColor(totalDelta);
  const hasData = totalCurrent > 0 || insights.totalPrevious > 0;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4}>Category insights</Title>
          <Text size="sm" c="dimmed">
            Month-over-month changes vs {comparisonLabel}.
          </Text>
        </Stack>
        {!hasData ? (
          <Text size="sm" c="dimmed">
            Add transactions to compare categories month over month.
          </Text>
        ) : (
          <>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Text size="sm" c="dimmed">
                Total spend change
              </Text>
              <Group gap="xs" align="center" wrap="nowrap">
                <Text fw={700} c={deltaColor}>
                  {totalDelta >= 0 ? "+" : "-"}
                  {formatINR(Math.abs(totalDelta))}
                </Text>
                <Badge variant="light" color={totalDelta >= 0 ? "red" : "teal"}>
                  {formatPercent(totalPercent)}
                </Badge>
              </Group>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Top movers
                </Text>
                {getDeltaIcon(totalDelta)}
              </Group>
              {movers.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No meaningful changes yet.
                </Text>
              ) : (
                <Stack gap="xs">{movers.map(renderMover)}</Stack>
              )}
            </Stack>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Outlier spend
                </Text>
                <AlertTriangle size={14} />
              </Group>
              {outliers.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No unusual spikes detected.
                </Text>
              ) : (
                <Stack gap="xs">{outliers.map(renderOutlier)}</Stack>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
};
