import { Button, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  icon,
}: EmptyStateProps) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="sm" align="flex-start">
        {icon}
        <Title order={3}>{title}</Title>
        <Text c="dimmed" size="sm" maw={560}>
          {message}
        </Text>
        {actionLabel ? <Button variant="light">{actionLabel}</Button> : null}
      </Stack>
    </Paper>
  );
}

