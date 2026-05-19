import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { appPath } from "../../app/paths";
import {
  useGetCategoriesQuery,
  useGetReconciliationsQuery,
  useGetTransactionsByRangeQuery,
} from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { formatINR } from "../../lib/format";
import {
  getDisplayCategoryId,
  getTransactionCounterpartyName,
} from "../../lib/transactions";

type AccountDetailsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  account: Account | null;
};

export const AccountDetailsDrawer = ({
  opened,
  onClose,
  account,
}: AccountDetailsDrawerProps) => {
  const accountId = account?.id ?? null;
  const { data: categories = [] } = useGetCategoriesQuery(undefined, {
    skip: !opened,
  });
  const { data: reconciliations = [] } = useGetReconciliationsQuery(
    { accountId: accountId ?? undefined },
    { skip: !accountId }
  );
  const recentRange = useMemo(
    () => ({
      start: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
      end: dayjs().format("YYYY-MM-DD"),
    }),
    []
  );
  const { data: recentTransactions = [] } = useGetTransactionsByRangeQuery(
    recentRange,
    { skip: !accountId }
  );

  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name])
  );

  const latestReconciliation = reconciliations[0] ?? null;
  const reconciliationGap =
    account && latestReconciliation
      ? Number(latestReconciliation.statement_balance) -
        Number(account.current_balance ?? 0)
      : null;
  const reconciliationBadge = (() => {
    if (reconciliationGap === null) {
      return { color: "gray", label: "No statement" };
    }
    if (Math.abs(reconciliationGap) < 0.01) {
      return { color: "teal", label: "Matched" };
    }
    if (reconciliationGap > 0) {
      return { color: "orange", label: "Shortfall" };
    }
    return { color: "red", label: "Overage" };
  })();
  const balanceHistory = [...reconciliations]
    .sort((a, b) => dayjs(a.statement_date).diff(dayjs(b.statement_date)))
    .map((item) => ({
      date: dayjs(item.statement_date).format("DD MMM"),
      value: item.statement_balance,
    }));

  const recentAccountTransactions = accountId
    ? recentTransactions
        .filter((tx) => tx.account_id === accountId)
        .slice(0, 6)
    : [];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Account details"
      position="right"
      size="md"
    >
      {account ? (
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Account
              </Text>
              <Text fw={600}>{account.name}</Text>
            </Stack>
            <Badge variant="light" color="blue" radius="sm">
              {account.type === "card" ? "Credit card" : account.type}
            </Badge>
          </Group>

          <Divider />

          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Current balance
            </Text>
            <Text fw={600}>{formatINR(account.current_balance ?? 0, account.currency)}</Text>
          </Group>

          <Divider />

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Last reconciliation
            </Text>
            {latestReconciliation ? (
              <Stack gap={6}>
                <Group justify="space-between" align="center">
                  <Text size="sm">
                    {dayjs(latestReconciliation.statement_date).format(
                      "DD MMM YYYY"
                    )}
                  </Text>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {formatINR(latestReconciliation.statement_balance, account.currency)}
                    </Text>
                    {latestReconciliation.adjusted ? (
                      <Badge size="xs" variant="light" color="orange">
                        Adjusted
                      </Badge>
                    ) : null}
                  </Group>
                </Group>
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <Badge size="xs" variant="light" color={reconciliationBadge.color}>
                      {reconciliationBadge.label}
                    </Badge>
                    {reconciliationGap !== null ? (
                      <Text size="xs" c="dimmed">
                        {reconciliationGap === 0
                          ? "0"
                          : formatINR(Math.abs(reconciliationGap), account.currency)}
                      </Text>
                    ) : null}
                  </Group>
                  {reconciliationGap !== null && Math.abs(reconciliationGap) >= 0.01 ? (
                    <Button
                      size="xs"
                      variant="light"
                      component={Link}
                      to={appPath("/settings")}
                    >
                      Fix balance
                    </Button>
                  ) : null}
                </Group>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No reconciliations yet.
              </Text>
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Balance history
              </Text>
              <Text size="xs" c="dimmed">
                From reconciliations
              </Text>
            </Group>
            {balanceHistory.length > 1 ? (
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer>
                  <LineChart data={balanceHistory}>
                    <XAxis dataKey="date" tickMargin={8} />
                    <YAxis
                      tickFormatter={(value) => formatINR(Number(value), account.currency)}
                      width={70}
                    />
                    <RechartsTooltip
                      formatter={(value) => formatINR(Number(value), account.currency)}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                Add at least two reconciliations to see history.
              </Text>
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Recent transactions
              </Text>
              <Text size="xs" c="dimmed">
                Last 90 days
              </Text>
            </Group>
            {recentAccountTransactions.length > 0 ? (
              <Stack gap="sm">
                {recentAccountTransactions.map((tx) => {
                  const displayCategoryId = getDisplayCategoryId(tx);
                  const categoryLabel = displayCategoryId
                    ? categoryMap.get(displayCategoryId) ?? "Uncategorized"
                    : "Uncategorized";
                  const sign = tx.type === "expense" ? "-" : "+";
                  const amountLabel = tx.is_transfer
                    ? formatINR(tx.amount, account.currency)
                    : `${sign}${formatINR(tx.amount, account.currency)}`;
                  const counterparty = getTransactionCounterpartyName(tx);
                  const context = counterparty
                    ? tx.notes?.trim()
                      ? `${counterparty} - ${tx.notes.trim()}`
                      : counterparty
                    : tx.notes ?? "No details";
                  return (
                    <Group key={tx.id} justify="space-between" align="center">
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>
                          {categoryLabel}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {dayjs(tx.date).format("DD MMM")} · {context}
                        </Text>
                      </Stack>
                      <Stack gap={4} align="flex-end">
                        <Text size="sm" fw={600}>
                          {amountLabel}
                        </Text>
                        {tx.is_transfer ? (
                          <Badge size="xs" variant="light" color="gray">
                            Transfer
                          </Badge>
                        ) : tx.is_reimbursement ? (
                          <Badge size="xs" variant="light" color="blue">
                            Reimbursement
                          </Badge>
                        ) : (
                          <Badge
                            size="xs"
                            variant="light"
                            color={tx.type === "income" ? "teal" : "red"}
                          >
                            {tx.type === "income" ? "Income" : "Expense"}
                          </Badge>
                        )}
                      </Stack>
                    </Group>
                  );
                })}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No recent transactions for this account.
              </Text>
            )}
          </Stack>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select an account to see details.
        </Text>
      )}
    </Drawer>
  );
};
