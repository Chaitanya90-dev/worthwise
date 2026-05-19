import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SetupChecklistItem } from "./SetupChecklistCard";

type InsightsCardProps = {
  showSetup: boolean;
  showWeekly: boolean;
  setupItems: SetupChecklistItem[];
  weeklyInsights: string[];
  weeklyNudge: string;
  style?: React.CSSProperties;
};

export const InsightsCard = ({
  showSetup,
  showWeekly,
  setupItems,
  weeklyInsights,
  weeklyNudge,
  style,
}: InsightsCardProps) => {
  const availableTabs = useMemo(() => {
    const tabs: Array<"setup" | "weekly"> = [];
    if (showSetup) {
      tabs.push("setup");
    }
    if (showWeekly) {
      tabs.push("weekly");
    }
    return tabs;
  }, [showSetup, showWeekly]);
  const [activeTab, setActiveTab] = useState<"setup" | "weekly">(
    availableTabs[0] ?? "setup"
  );
  const showTabs = availableTabs.length > 1;

  const resolvedTab =
    availableTabs.includes(activeTab) ? activeTab : availableTabs[0] ?? "setup";

  const completed = setupItems.filter((item) => item.done).length;
  const total = setupItems.length;
  const isComplete = total > 0 && completed === total;
  const displayInsights = weeklyInsights.slice(0, 2);

  const setupContent = (
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text fw={600}>Setup checklist</Text>
        <Badge variant="light" color={isComplete ? "teal" : "blue"}>
          {completed}/{total} done
        </Badge>
      </Group>
      <Stack gap="sm">
        {setupItems.map((item) => (
          <Group
            key={item.id}
            justify="space-between"
            align="center"
            wrap="wrap"
          >
            <Stack gap={2} style={{ minWidth: 200 }}>
              <Group gap="xs">
                <Badge variant="light" color={item.done ? "teal" : "gray"}>
                  {item.done ? "Done" : "Todo"}
                </Badge>
                <Text
                  fw={600}
                  style={{
                    textDecoration: item.done ? "line-through" : undefined,
                  }}
                >
                  {item.label}
                </Text>
              </Group>
              {item.description ? (
                <Text size="xs" c="dimmed">
                  {item.description}
                </Text>
              ) : null}
            </Stack>
            {!item.done && item.action ? (
              <Button
                component={Link}
                to={item.action.to}
                variant="light"
                size="xs"
              >
                {item.action.label}
              </Button>
            ) : null}
          </Group>
        ))}
      </Stack>
    </Stack>
  );

  const weeklyContent = (
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text fw={600}>Weekly check-in</Text>
        <Badge variant="light" color="blue">
          This week
        </Badge>
      </Group>
      <Stack gap="sm">
        <Stack gap="xs">
          {displayInsights.map((insight, index) => (
            <Group key={insight} align="flex-start" wrap="nowrap">
              <Badge variant="light" color="blue">
                Insight {index + 1}
              </Badge>
              <Text size="sm">{insight}</Text>
            </Group>
          ))}
        </Stack>
        <Paper
          withBorder
          radius="md"
          p="sm"
          style={{ background: "var(--surface-alt)" }}
        >
          <Group align="flex-start" wrap="nowrap">
            <Badge variant="light" color="teal">
              Nudge
            </Badge>
            <Text size="sm">{weeklyNudge}</Text>
          </Group>
        </Paper>
      </Stack>
    </Stack>
  );

  const content = showSetup ? setupContent : weeklyContent;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      className="dashboard-priority-card dashboard-insights-card dashboard-section"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4}>Insights</Title>
          <Text size="sm" c="dimmed">
            Checklist progress and weekly highlights in one place.
          </Text>
        </Stack>
        {showTabs ? (
          <Tabs
            value={resolvedTab}
            onChange={(value) => setActiveTab(value as "setup" | "weekly")}
            variant="pills"
          >
            <Tabs.List>
              {showSetup ? <Tabs.Tab value="setup">Checklist</Tabs.Tab> : null}
              {showWeekly ? <Tabs.Tab value="weekly">Weekly</Tabs.Tab> : null}
            </Tabs.List>
            {showSetup ? (
              <Tabs.Panel value="setup" pt="sm">
                {setupContent}
              </Tabs.Panel>
            ) : null}
            {showWeekly ? (
              <Tabs.Panel value="weekly" pt="sm">
                {weeklyContent}
              </Tabs.Panel>
            ) : null}
          </Tabs>
        ) : (
          content
        )}
      </Stack>
    </Paper>
  );
};
