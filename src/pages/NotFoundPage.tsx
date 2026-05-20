import { Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { paths } from '../app/paths';

export function NotFoundPage() {
  return (
    <Stack gap="sm">
      <Title order={1}>Page not found</Title>
      <Text c="dimmed">The requested Worthwise page does not exist.</Text>
      <Button component={Link} to={paths.dashboard} w="fit-content">
        Go to dashboard
      </Button>
    </Stack>
  );
}

