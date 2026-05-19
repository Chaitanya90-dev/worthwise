import {
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Timeline,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { CheckCircle2, Download, History, Repeat } from "lucide-react";
import {
  useAddReconciliationMutation,
  useGetAccountsQuery,
  useGetReconciliationsQuery,
  useUpdateAccountMutation,
} from "../../features/api/apiSlice";
import type { Account, Reconciliation } from "../../types/finance";
import { formatINR } from "../../lib/format";
import { SectionCard } from "./SectionCard";

type ReconcileFormState = {
  account_id: string;
  statement_date: string;
  statement_balance: string;
  note: string;
  adjust_balance: boolean;
};

const buildInitialForm = (accountId?: string | null): ReconcileFormState => ({
  account_id: accountId ?? "",
  statement_date: dayjs().format("YYYY-MM-DD"),
  statement_balance: "",
  note: "",
  adjust_balance: true,
});

const buildLatestReconciliationMap = (items: Reconciliation[]) => {
  const map = new Map<string, Reconciliation>();
  items.forEach((item) => {
    if (!map.has(item.account_id)) {
      map.set(item.account_id, item);
    }
  });
  return map;
};

type HistoryItem = {
  id: string;
  statement_date: string;
  statement_balance: number;
  adjusted: boolean;
  note: string | null;
  deltaFromPrevious: number | null;
};

const buildHistoryItems = (items: Reconciliation[]): HistoryItem[] => {
  const sorted = [...items].sort((a, b) =>
    dayjs(b.statement_date).diff(dayjs(a.statement_date))
  );
  return sorted.map((item, index) => {
    const previous = sorted[index + 1];
    const delta =
      previous ? item.statement_balance - previous.statement_balance : null;
    return {
      id: item.id,
      statement_date: item.statement_date,
      statement_balance: item.statement_balance,
      adjusted: item.adjusted,
      note: item.note,
      deltaFromPrevious: delta,
    };
  });
};

const escapeCsvValue = (value: string) => {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document?.createElement("a");
  if (!link) {
    URL.revokeObjectURL(url);
    return;
  }
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const ReconciliationManager = () => {
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: reconciliations = [] } = useGetReconciliationsQuery({});
  const [addReconciliation, { isLoading: isSaving }] =
    useAddReconciliationMutation();
  const [updateAccount, { isLoading: isUpdating }] =
    useUpdateAccountMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [form, setForm] = useState<ReconcileFormState>(() =>
    buildInitialForm(null)
  );
  const [error, setError] = useState<string | null>(null);

  const latestByAccount = useMemo(
    () => buildLatestReconciliationMap(reconciliations),
    [reconciliations]
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type}`,
      })),
    [accounts]
  );

  const selectedAccount = useMemo<Account | null>(() => {
    if (!form.account_id) {
      return null;
    }
    return accounts.find((account) => account.id === form.account_id) ?? null;
  }, [accounts, form.account_id]);

  const historyAccount = useMemo(
    () =>
      historyAccountId
        ? accounts.find((account) => account.id === historyAccountId) ?? null
        : null,
    [accounts, historyAccountId]
  );

  const historyItems = useMemo(() => {
    if (!historyAccountId) {
      return [];
    }
    return buildHistoryItems(
      reconciliations.filter((item) => item.account_id === historyAccountId)
    );
  }, [reconciliations, historyAccountId]);

  const parsedStatement = form.statement_balance
    ? Number(form.statement_balance)
    : null;
  const delta =
    selectedAccount && parsedStatement !== null && !Number.isNaN(parsedStatement)
      ? parsedStatement - Number(selectedAccount.current_balance ?? 0)
      : null;

  const openReconcile = (accountId?: string | null) => {
    setForm(buildInitialForm(accountId ?? ""));
    setError(null);
    setModalOpen(true);
  };

  const openHistory = (accountId: string) => {
    setHistoryAccountId(accountId);
  };

  const handleCloseHistory = () => {
    setHistoryAccountId(null);
  };

  const handleExportHistory = () => {
    if (!historyAccount) {
      return;
    }
    if (historyItems.length === 0) {
      return;
    }
    const header = [
      "Statement Date",
      "Statement Balance",
      "Adjusted",
      "Delta From Previous",
      "Note",
    ];
    const rows = historyItems.map((item) => [
      item.statement_date,
      item.statement_balance.toFixed(2),
      item.adjusted ? "Yes" : "No",
      item.deltaFromPrevious === null
        ? ""
        : item.deltaFromPrevious.toFixed(2),
      item.note ?? "",
    ]);
    const safeName = historyAccount.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    downloadCsv(
      `cashcove-reconciliation-${safeName || "account"}.csv`,
      [header, ...rows]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.account_id) {
      setError("Select an account.");
      return;
    }
    const balance = Number(form.statement_balance);
    if (!form.statement_balance || Number.isNaN(balance)) {
      setError("Enter a valid statement balance.");
      return;
    }
    if (!form.statement_date) {
      setError("Select a statement date.");
      return;
    }
    const account = accounts.find((item) => item.id === form.account_id);
    if (!account) {
      setError("Account not found.");
      return;
    }

    try {
      await addReconciliation({
        account_id: form.account_id,
        statement_balance: balance,
        statement_date: form.statement_date,
        note: form.note.trim() ? form.note.trim() : null,
        adjusted: form.adjust_balance,
      }).unwrap();

      if (form.adjust_balance) {
        await updateAccount({
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          current_balance: balance,
        }).unwrap();
      }

      setModalOpen(false);
    } catch {
      setError("Unable to save reconciliation.");
    }
  };

  return (
    <>
      <SectionCard
        title="Reconciliation"
        description="Compare account balances with statement snapshots and capture discrepancies."
        badge={`${reconciliations.length} entries`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Capture statement balances to confirm your accounts are in sync.
          </Text>
          <Button
            onClick={() => openReconcile(null)}
            leftSection={<Repeat size={16} strokeWidth={2} />}
            variant="light"
            disabled={accounts.length === 0}
          >
            New reconciliation
          </Button>
        </Group>
        <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Account</Table.Th>
              <Table.Th>Current balance</Table.Th>
              <Table.Th>Last statement</Table.Th>
              <Table.Th>Statement balance</Table.Th>
              <Table.Th>Delta</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.map((account) => {
              const latest = latestByAccount.get(account.id);
              const statementBalance = latest?.statement_balance ?? null;
              const statementDate = latest?.statement_date ?? null;
              const gap =
                statementBalance === null
                  ? null
                  : statementBalance - Number(account.current_balance ?? 0);
              let badgeColor = "gray";
              let badgeLabel = "No statement";
              if (gap !== null) {
                if (Math.abs(gap) < 0.01) {
                  badgeColor = "teal";
                  badgeLabel = "Matched";
                } else if (gap > 0) {
                  badgeColor = "orange";
                  badgeLabel = "Shortfall";
                } else {
                  badgeColor = "red";
                  badgeLabel = "Overage";
                }
              }
              return (
                <Table.Tr key={account.id}>
                  <Table.Td>{account.name}</Table.Td>
                  <Table.Td>{formatINR(account.current_balance ?? 0, account.currency)}</Table.Td>
                  <Table.Td>
                    {statementDate ? dayjs(statementDate).format("DD MMM YYYY") : "-"}
                  </Table.Td>
                  <Table.Td>
                    {statementBalance !== null
                      ? formatINR(statementBalance)
                      : "-"}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge variant="light" color={badgeColor} radius="sm">
                        {badgeLabel}
                      </Badge>
                      {gap !== null ? (
                        <Text size="sm" c="dimmed">
                          {gap === 0 ? "0" : formatINR(Math.abs(gap))}
                        </Text>
                      ) : null}
                    </Group>
                  </Table.Td>
                  <Table.Td width={140}>
                    <Group gap={6} justify="flex-end">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => openHistory(account.id)}
                        leftSection={<History size={14} strokeWidth={2} />}
                      >
                        History
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => openReconcile(account.id)}
                        leftSection={<CheckCircle2 size={14} strokeWidth={2} />}
                      >
                        Reconcile
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {accounts.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    Add an account to start reconciling.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </SectionCard>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Reconcile account"
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Account"
            data={accountOptions}
            value={form.account_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, account_id: value ?? "" }))
            }
            placeholder="Select account"
            searchable
            required
          />
          <DateInput
            label="Statement date"
            value={form.statement_date ? new Date(form.statement_date) : null}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                statement_date: value
                  ? new Date(value).toISOString().slice(0, 10)
                  : "",
              }))
            }
            clearable={false}
            required
          />
          <TextInput
            label="Statement balance"
            type="number"
            value={form.statement_balance}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                statement_balance: event.target.value,
              }))
            }
            placeholder="0"
            step="0.01"
            required
          />
          <TextInput
            label="Note"
            value={form.note}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, note: event.target.value }))
            }
            placeholder="Optional context"
          />
          <Group justify="space-between" align="center">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Delta
              </Text>
              <Text fw={600}>
                {delta === null ? "-" : formatINR(delta)}
              </Text>
            </Stack>
            <Group gap="xs">
              <Badge variant="light" color={form.adjust_balance ? "blue" : "gray"}>
                {form.adjust_balance ? "Adjust balance" : "Record only"}
              </Badge>
            </Group>
          </Group>
          <Button
            variant={form.adjust_balance ? "light" : "subtle"}
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                adjust_balance: !prev.adjust_balance,
              }))
            }
          >
            {form.adjust_balance
              ? "Turn off balance adjustment"
              : "Adjust account balance to statement"}
          </Button>
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={isSaving || isUpdating}
              color="green"
            >
              Save reconciliation
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(historyAccountId)}
        onClose={handleCloseHistory}
        title={historyAccount ? `${historyAccount.name} history` : "History"}
        size="lg"
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {historyItems.length} statement snapshots
            </Text>
            <Button
              variant="light"
              leftSection={<Download size={16} strokeWidth={2} />}
              onClick={handleExportHistory}
              disabled={historyItems.length === 0}
            >
              Export CSV
            </Button>
          </Group>
          {historyItems.length === 0 ? (
            <Text size="sm" c="dimmed">
              No reconciliations yet for this account.
            </Text>
          ) : (
            <Timeline active={0} bulletSize={12} lineWidth={2}>
              {historyItems.map((item) => (
                <Timeline.Item key={item.id} title={dayjs(item.statement_date).format("DD MMM YYYY")}>
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text fw={600}>{formatINR(item.statement_balance)}</Text>
                      <Badge variant="light" color={item.adjusted ? "blue" : "gray"}>
                        {item.adjusted ? "Adjusted" : "Record only"}
                      </Badge>
                    </Group>
                    {item.deltaFromPrevious !== null ? (
                      <Text size="xs" c="dimmed">
                        Δ {formatINR(item.deltaFromPrevious)}
                      </Text>
                    ) : null}
                    {item.note ? (
                      <Text size="xs" c="dimmed">
                        {item.note}
                      </Text>
                    ) : null}
                  </Stack>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Stack>
      </Modal>
    </>
  );
};
