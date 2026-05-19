import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";

type WeeklyCheckInCardProps = {
  insights: string[];
  nudge: string;
  style?: React.CSSProperties;
};

export const WeeklyCheckInCard = ({
  insights,
  nudge,
  style,
}: WeeklyCheckInCardProps) => {
  const displayInsights = insights.slice(0, 2);

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      className="dashboard-priority-card dashboard-checkin-card dashboard-section"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Group justify="space-between" align="center" mb="sm" wrap="wrap">
        <Stack gap={2}>
          <Title order={4}>Weekly check-in</Title>
          <Text size="sm" c="dimmed">
            Top insights and one action to try.
          </Text>
        </Stack>
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
            <Text size="sm">{nudge}</Text>
          </Group>
        </Paper>
      </Stack>
    </Paper>
  );
};
