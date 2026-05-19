import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { appPath } from "../../app/paths";
import { EmptyState } from "../common/EmptyState";
import { formatINR } from "../../lib/format";
import { getDisplayAmount } from "../../lib/moneyConfig";
import type { Account } from "../../types/finance";

type AccountBalancesProps = {
  accounts: Account[];
  hidden: boolean;
  onToggle: () => void;
  loading?: boolean;
  icon: React.ReactNode;
  style?: React.CSSProperties;
};

const maskValue = (
  value: number,
  hidden: boolean,
  sourceCurrency?: string | null
) => (hidden ? "• • •" : formatINR(value, sourceCurrency));

export const AccountBalances = ({
  accounts,
  hidden,
  onToggle,
  loading = false,
  icon,
  style,
}: AccountBalancesProps) => {
  const total = accounts.reduce(
    (sum, account) =>
      sum + (getDisplayAmount(account.current_balance ?? 0, account.currency) ?? 0),
    0
  );
  let content: React.ReactNode = null;

  if (loading) {
    content = (
      <Text size="sm" c="dimmed">
        Loading accounts...
      </Text>
    );
  } else if (accounts.length === 0) {
    content = (
      <EmptyState
        description="No accounts yet. Add them in Settings."
        action={{ label: "Add accounts", to: appPath("/settings") }}
      />
    );
  } else {
    content = accounts.map((account) => {
      const accountTypeLabel =
        account.type === "card" ? "Credit card" : account.type;
      return (
        <Group key={account.id} justify="space-between" align="center">
          <Group gap="xs">
            <Text fw={600}>{account.name}</Text>
            <Badge variant="light" color="blue">
              {accountTypeLabel}
            </Badge>
          </Group>
          <Text fw={600}>
            {maskValue(account.current_balance ?? 0, hidden, account.currency)}
          </Text>
        </Group>
      );
    });
  }

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Group justify="space-between" align="center" mb="xs">
        <Stack gap={4}>
          <Title order={4}>Accounts</Title>
          <Text size="sm" c="dimmed">
            Balances across bank, credit card, cash, and wallet.
          </Text>
        </Stack>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onToggle}
          aria-label={hidden ? "Show balances" : "Hide balances"}
        >
          {icon}
        </ActionIcon>
      </Group>
      <Group justify="space-between" align="center" mb="sm">
        <Text size="sm" c="dimmed">
          Total
        </Text>
        <Text fw={700}>{maskValue(total, hidden)}</Text>
      </Group>
      <Stack gap={8}>
        {content}
      </Stack>
    </Paper>
  );
};
