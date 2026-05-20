import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

type ModuleHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function ModuleHeader({
  title,
  description,
  actions,
}: ModuleHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Stack gap={4}>
        <Title order={1}>{title}</Title>
        <Text c="dimmed" size="sm" maw={760}>
          {description}
        </Text>
      </Stack>
      {actions}
    </Group>
  );
}

