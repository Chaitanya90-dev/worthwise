import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { PageStatusChips } from "../common/PageStatusChips";

type CashflowHeaderProps = {
  monthLabel: string;
  filteredCount: number;
  totalCount: number;
  recurringCount: number;
  sharedCount: number;
  reimbursementCount: number;
  onExport: () => void;
  viewToggle?: ReactNode;
};

export const CashflowHeader = ({
  monthLabel,
  filteredCount,
  totalCount,
  recurringCount,
  sharedCount,
  reimbursementCount,
  onExport,
  viewToggle,
}: CashflowHeaderProps) => {
  const statusChips = [
    {
      id: "visible",
      label: `${filteredCount} visible`,
      color: "blue",
      tooltip:
        filteredCount === totalCount
          ? "All monthly cashflow transactions are visible."
          : `${totalCount} total non-transfer transactions in this month.`,
    },
    {
      id: "recurring",
      label: `${recurringCount} recurring`,
      color: recurringCount > 0 ? "grape" : "gray",
      tooltip: "Recurring transactions in the current cashflow result set.",
    },
    {
      id: "shared",
      label: `${sharedCount} shared`,
      color: sharedCount > 0 ? "orange" : "gray",
      tooltip: "Shared expenses included in the current cashflow result set.",
    },
    {
      id: "reimbursements",
      label: `${reimbursementCount} reimbursements`,
      color: reimbursementCount > 0 ? "teal" : "gray",
      tooltip: "Expense offsets included in the current cashflow result set.",
    },
  ];

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={4}>
          <Title order={4}>{monthLabel}</Title>
          {viewToggle}
          <Text size="sm" c="dimmed">
            Cashflow overview
          </Text>
          <PageStatusChips items={statusChips} />
        </Stack>
        <Button
          variant="light"
          color="blue"
          size="xs"
          onClick={onExport}
          disabled={filteredCount === 0}
          leftSection={<Download size={14} strokeWidth={2} />}
        >
          Export CSV
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mt="sm">
        {filteredCount === totalCount
          ? "Track how income and expenses move together each month."
          : `Filtered ${filteredCount} of ${totalCount} cashflow transactions.`}
      </Text>
    </Paper>
  );
};
