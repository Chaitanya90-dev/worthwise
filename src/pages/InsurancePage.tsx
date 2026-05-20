import { Button, SimpleGrid, Stack } from '@mantine/core';
import { Plus, ScrollText, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ModuleHeader } from '../components/common/ModuleHeader';
import { StatCard } from '../components/common/StatCard';
import { formatInr } from '../lib/format';

export function InsurancePage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Insurance"
        description="Track LIC policies, term plans, premiums, nominees, coverage, maturity dates, and renewal reminders."
        actions={
          <Button leftSection={<Plus size={16} />} disabled>
            Add policy
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <StatCard
          label="Term Cover"
          value={formatInr(0)}
          helper="Pure risk coverage"
          icon={<ShieldCheck size={20} />}
          tone="grape"
        />
        <StatCard
          label="LIC Sum Assured"
          value={formatInr(0)}
          helper="Traditional policies"
          icon={<ScrollText size={20} />}
          tone="blue"
        />
      </SimpleGrid>
      <EmptyState
        title="No policies yet"
        message="LIC and term policy tracking will follow after the loan module decisions are locked."
      />
    </Stack>
  );
}

