import { Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: ReactNode;
  tone?: 'teal' | 'blue' | 'orange' | 'grape' | 'gray';
};

export function StatCard({
  label,
  value,
  helper,
  icon,
  tone = 'teal',
}: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">
            {label}
          </Text>
          <Text fw={800} size="xl">
            {value}
          </Text>
          {helper ? (
            <Text size="sm" c="dimmed">
              {helper}
            </Text>
          ) : null}
        </Stack>
        <ThemeIcon variant="light" color={tone} radius="md" size={40}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

