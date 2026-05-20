import { Button, Paper, SimpleGrid, Stack, Table } from '@mantine/core';
import { Landmark, Plus } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ModuleHeader } from '../components/common/ModuleHeader';
import { StatCard } from '../components/common/StatCard';
import { formatInr } from '../lib/format';

export function LoansPage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Loans And Home Loans"
        description="Track EMIs, repayment history, floating-rate changes, prepayments, property details, and lender account information."
        actions={
          <Button leftSection={<Plus size={16} />} disabled>
            Add loan
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatCard
          label="Outstanding"
          value={formatInr(0)}
          helper="Across active loans"
          icon={<Landmark size={20} />}
          tone="orange"
        />
        <StatCard
          label="Monthly EMI"
          value={formatInr(0)}
          helper="Expected debt outflow"
          icon={<Landmark size={20} />}
          tone="blue"
        />
        <StatCard
          label="Prepayments"
          value={formatInr(0)}
          helper="Tracked separately"
          icon={<Landmark size={20} />}
          tone="teal"
        />
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Loan</Table.Th>
                <Table.Th>Lender</Table.Th>
                <Table.Th>Rate</Table.Th>
                <Table.Th>EMI</Table.Th>
                <Table.Th>Outstanding</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <EmptyState
                    title="Loan records are next"
                    message="Phase 1 will add create/edit forms, repayment posting, rate history, prepayment scenarios, and home-loan property details."
                  />
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}

