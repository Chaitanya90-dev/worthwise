import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { QUICK_ACTIONS } from "../../lib/quickActions";

type QuickActionsCardProps = {
  style?: React.CSSProperties;
};

export const QuickActionsCard = ({ style }: QuickActionsCardProps) => (
  <Paper
    withBorder
    shadow="sm"
    radius="lg"
    p="md"
    className="dashboard-priority-card dashboard-section"
    style={{ display: "flex", flexDirection: "column", gap: 12, ...style }}
  >
    <Group justify="space-between" align="center" wrap="wrap">
      <Stack gap={2}>
        <Title order={4}>Quick actions</Title>
        <Text size="sm" c="dimmed">
          Jump straight into the most common tasks.
        </Text>
      </Stack>
      <Text size="xs" c="dimmed">
        Open quick actions with Ctrl/Cmd + .
      </Text>
    </Group>
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
      {QUICK_ACTIONS.map((action) => (
        <Paper
          key={action.id}
          withBorder
          radius="md"
          p="sm"
          style={{ background: "var(--surface-alt)" }}
        >
          <Stack gap={6}>
            <Button
              component={Link}
              to={action.to}
              variant="light"
              fullWidth
              leftSection={action.icon}
              rightSection={<ArrowUpRight size={14} />}
            >
              {action.label}
            </Button>
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {action.description}
              </Text>
              <Badge variant="light" color="blue">
                {action.shortcutLabel}
              </Badge>
            </Group>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  </Paper>
);
