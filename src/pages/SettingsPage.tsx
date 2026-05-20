import { Code, Paper, Stack, Text, Title } from '@mantine/core';
import { ModuleHeader } from '../components/common/ModuleHeader';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export function SettingsPage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Settings"
        description="Manage locale, currency, Supabase connection, and finance calculation preferences."
      />
      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Title order={2}>Environment</Title>
          <Text size="sm">
            Supabase:{' '}
            <Code>{isSupabaseConfigured ? 'configured' : 'not configured'}</Code>
          </Text>
          <Text size="sm">
            Currency: <Code>INR</Code>
          </Text>
          <Text size="sm">
            Locale: <Code>en-IN</Code>
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}

