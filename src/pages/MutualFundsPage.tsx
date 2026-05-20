import { Button, SimpleGrid, Stack } from '@mantine/core';
import { ChartNoAxesCombined, Plus, Repeat } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ModuleHeader } from '../components/common/ModuleHeader';
import { StatCard } from '../components/common/StatCard';
import { formatInr } from '../lib/format';

export function MutualFundsPage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Mutual Funds"
        description="Track SIPs, lump sum investments, folios, units, NAV updates, redemptions, and portfolio value."
        actions={
          <Button leftSection={<Plus size={16} />} disabled>
            Add fund
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <StatCard
          label="Current Value"
          value={formatInr(0)}
          helper="Manual NAV until integrations are chosen"
          icon={<ChartNoAxesCombined size={20} />}
          tone="teal"
        />
        <StatCard
          label="Monthly SIP"
          value={formatInr(0)}
          helper="Recurring investments"
          icon={<Repeat size={20} />}
          tone="orange"
        />
      </SimpleGrid>
      <EmptyState
        title="No mutual funds yet"
        message="The first investment version will support manual holdings and SIP schedules before external NAV integrations."
      />
    </Stack>
  );
}

