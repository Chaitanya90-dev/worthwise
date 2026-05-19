import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
};

export const SectionCard = ({
  title,
  description,
  badge,
  children,
}: SectionCardProps) => (
  <Paper withBorder shadow="sm" radius="lg" p="md">
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="sm">
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Title order={4}>{title}</Title>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Stack>
      {badge ? (
        <Badge variant="light" color="blue" style={{ alignSelf: "flex-start" }}>
          {badge}
        </Badge>
      ) : null}
    </Group>
    {children}
  </Paper>
);
