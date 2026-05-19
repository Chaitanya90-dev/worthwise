import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";

export type SetupChecklistItem = {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  action?: {
    label: string;
    to: string;
  };
};

type SetupChecklistCardProps = {
  items: SetupChecklistItem[];
  style?: React.CSSProperties;
};

export const SetupChecklistCard = ({ items, style }: SetupChecklistCardProps) => {
  const completed = items.filter((item) => item.done).length;
  const total = items.length;
  const isComplete = completed === total;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      className="dashboard-priority-card dashboard-checklist-card dashboard-section"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Group justify="space-between" align="center" mb="sm" wrap="wrap">
        <Stack gap={2}>
          <Title order={4}>Setup checklist</Title>
          <Text size="sm" c="dimmed">
            Finish the basics to unlock smarter insights.
          </Text>
        </Stack>
        <Badge variant="light" color={isComplete ? "teal" : "blue"}>
          {completed}/{total} done
        </Badge>
      </Group>
      <Stack gap="sm">
        {items.map((item) => (
          <Group
            key={item.id}
            justify="space-between"
            align="center"
            wrap="wrap"
          >
            <Stack gap={2} style={{ minWidth: 200 }}>
              <Group gap="xs">
                <Badge
                  variant="light"
                  color={item.done ? "teal" : "gray"}
                >
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
    </Paper>
  );
};
