import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { formatINR } from "../../lib/format";
import type { CategoryInsightItem } from "../../lib/categoryInsights";
import type { WhatChangedInsights } from "../../lib/whatChanged";

type WhatChangedCardProps = {
  insights: WhatChangedInsights;
  outliers: CategoryInsightItem[];
  comparisonLabel: string;
  style?: CSSProperties;
};

export const WhatChangedCard = ({
  insights,
  outliers,
  comparisonLabel,
  style,
}: WhatChangedCardProps) => (
  <Paper
    withBorder
    shadow="sm"
    radius="lg"
    p="md"
    style={{ display: "flex", flexDirection: "column", ...style }}
  >
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={2}>
          <Title order={4}>What changed</Title>
          <Text size="sm" c="dimmed">
            Highlights since {comparisonLabel}.
          </Text>
        </Stack>
        <Sparkles size={18} />
      </Group>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            New counterparties
          </Text>
          <Badge
            variant="light"
            color={insights.totalNewCounterparties > 0 ? "blue" : "gray"}
          >
            {insights.totalNewCounterparties}
          </Badge>
        </Group>
        {insights.totalNewCounterparties === 0 ? (
          <Text size="xs" c="dimmed">
            No new counterparties yet. Add payee or counterparty names on transactions.
          </Text>
        ) : (
          <Stack gap={4}>
            {insights.newCounterparties.map((counterparty) => (
              <Group key={counterparty.name} justify="space-between" align="center">
                <Text size="sm" lineClamp={1}>
                  {counterparty.name}
                </Text>
                <Badge variant="light" color="blue">
                  {counterparty.count}x
                </Badge>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            Unusual spend
          </Text>
          <AlertTriangle size={16} />
        </Group>
        {outliers.length === 0 ? (
          <Text size="xs" c="dimmed">
            No big spikes compared to last month.
          </Text>
        ) : (
          <Stack gap={4}>
            {outliers.slice(0, 2).map((item) => (
              <Group key={item.id} justify="space-between" align="center">
                <Text size="sm" lineClamp={1}>
                  {item.name}
                </Text>
                <Badge variant="light" color="orange">
                  +{formatINR(Math.abs(item.delta))}
                </Badge>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  </Paper>
);
