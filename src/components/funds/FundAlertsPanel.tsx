import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { FundAlert } from "../../lib/fundInsights";

type FundAlertsPanelProps = {
  alerts: FundAlert[];
};

const toneMap: Record<FundAlert["tone"], string> = {
  red: "red",
  yellow: "yellow",
  green: "green",
  blue: "blue",
};

const toneLabel: Record<FundAlert["tone"], string> = {
  red: "At risk",
  yellow: "Attention",
  green: "On track",
  blue: "Info",
};

export const FundAlertsPanel = ({ alerts }: FundAlertsPanelProps) => (
  <Paper withBorder shadow="sm" radius="lg" p="md">
    <Group justify="space-between" align="center" mb="md">
      <Stack gap={2}>
        <Title order={4}>Milestones & alerts</Title>
        <Text size="sm" c="dimmed">
          Progress highlights and pacing nudges.
        </Text>
      </Stack>
      <Badge variant="light" color="blue">
        {alerts.length} active
      </Badge>
    </Group>
    {alerts.length === 0 ? (
      <Text size="sm" c="dimmed">
        No alerts yet. Add contributions to unlock milestones.
      </Text>
    ) : (
      <Stack gap="sm">
        {alerts.map((alert) => (
          <Paper key={alert.id} withBorder radius="md" p="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {alert.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {alert.detail}
                </Text>
              </Stack>
              <Badge variant="light" color={toneMap[alert.tone]}>
                {toneLabel[alert.tone]}
              </Badge>
            </Group>
          </Paper>
        ))}
      </Stack>
    )}
  </Paper>
);
