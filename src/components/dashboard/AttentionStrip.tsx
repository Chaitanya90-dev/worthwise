import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export type AttentionItem = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  tone?: "red" | "orange" | "yellow" | "blue" | "teal";
  action?: {
    label: string;
    to: string;
  };
};

type AttentionStripProps = {
  items: AttentionItem[];
  style?: React.CSSProperties;
};

export const AttentionStrip = ({ items, style }: AttentionStripProps) => {
  const count = items.length;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      className="dashboard-attention-strip dashboard-section"
      style={style}
    >
      <Group justify="space-between" align="center" mb="sm" wrap="wrap">
        <Stack gap={2}>
          <Title order={4}>Actionable alerts</Title>
          <Text size="sm" c="dimmed">
            {count > 0
              ? "Resolve the top items to keep your plan on track."
              : "All clear. No immediate actions right now."}
          </Text>
        </Stack>
        <Badge variant="light" color={count > 0 ? "orange" : "blue"}>
          {count} item{count === 1 ? "" : "s"}
        </Badge>
      </Group>
      {count === 0 ? null : (
        <Stack gap="sm">
          {items.map((item) => (
            <Paper
              key={item.id}
              withBorder
              radius="md"
              p="sm"
              style={{ background: "var(--surface-alt)" }}
            >
              <Group justify="space-between" align="center" wrap="wrap">
                <Stack gap={2} style={{ flex: 1, minWidth: 220 }}>
                  <Group gap="xs" align="center" wrap="wrap">
                    <Text size="sm" fw={600}>
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <Badge variant="light" color={item.tone ?? "blue"}>
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {item.description}
                  </Text>
                </Stack>
                {item.action ? (
                  <Button
                    component={Link}
                    to={item.action.to}
                    variant="light"
                    size="xs"
                    color={item.tone ?? "blue"}
                    rightSection={<ArrowUpRight size={14} />}
                  >
                    {item.action.label}
                  </Button>
                ) : null}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
};
