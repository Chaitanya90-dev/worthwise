import {
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  CalendarClock,
  Landmark,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { ModuleHeader } from '../components/common/ModuleHeader';
import { StatCard } from '../components/common/StatCard';
import { formatInr } from '../lib/format';

const upcomingRows = [
  {
    name: 'Home loan EMI',
    dueDate: 'Pending setup',
    amount: 0,
    status: 'Not configured',
  },
  {
    name: 'LIC premium',
    dueDate: 'Pending setup',
    amount: 0,
    status: 'Not configured',
  },
  {
    name: 'Term insurance',
    dueDate: 'Pending setup',
    amount: 0,
    status: 'Not configured',
  },
];

export function DashboardPage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Financial Overview"
        description="A single view for net worth, debt, upcoming payments, insurance coverage, and investments."
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard
          label="Net Worth"
          value={formatInr(0)}
          helper="Assets minus liabilities"
          icon={<TrendingUp size={20} />}
          tone="teal"
        />
        <StatCard
          label="Debt Outstanding"
          value={formatInr(0)}
          helper="Loans and home loans"
          icon={<Landmark size={20} />}
          tone="orange"
        />
        <StatCard
          label="Upcoming 30 Days"
          value={formatInr(0)}
          helper="Payments due soon"
          icon={<CalendarClock size={20} />}
          tone="blue"
        />
        <StatCard
          label="Insurance Cover"
          value={formatInr(0)}
          helper="Life and term plans"
          icon={<ShieldCheck size={20} />}
          tone="grape"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={2}>Upcoming Payments</Title>
              <Badge variant="light" color="gray">
                Foundation
              </Badge>
            </Group>
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Payment</Table.Th>
                    <Table.Th>Due date</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {upcomingRows.map((row) => (
                    <Table.Tr key={row.name}>
                      <Table.Td>{row.name}</Table.Td>
                      <Table.Td>{row.dueDate}</Table.Td>
                      <Table.Td>{formatInr(row.amount)}</Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color="gray">
                          {row.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Title order={2}>Next Build Focus</Title>
            <Text size="sm" c="dimmed">
              Rich loan and home loan tracking is the first module. The data
              model already reserves space for repayments, property details,
              prepayments, rate history, and certificate exports.
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

