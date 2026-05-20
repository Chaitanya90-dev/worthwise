import { Button, Stack } from '@mantine/core';
import { CalendarPlus } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ModuleHeader } from '../components/common/ModuleHeader';

export function UpcomingPaymentsPage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Upcoming Payments"
        description="A unified timeline for EMIs, premiums, bills, subscriptions, SIPs, and manual obligations."
        actions={
          <Button leftSection={<CalendarPlus size={16} />} disabled>
            Add obligation
          </Button>
        }
      />
      <EmptyState
        title="No upcoming payments"
        message="Upcoming obligations will be generated from loans, insurance, recurring payments, and investment schedules."
      />
    </Stack>
  );
}

