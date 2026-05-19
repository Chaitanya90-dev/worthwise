import {
  Alert,
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import type { Account, Transaction } from "../../types/finance";
import { formatINR } from "../../lib/format";
import {
  useUpdateAccountMutation,
  useUpdateTransactionMutation,
} from "../../features/api/apiSlice";

type TransferDetailDrawerProps = {
  opened: boolean;
  onClose: () => void;
  transferGroupId: string | null;
  transactions: Transaction[];
  accounts: Account[];
};

type TransferFormState = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  date: string;
  note: string;
};

const buildInitialForm = (expense?: Transaction | null, income?: Transaction | null) => ({
  fromAccountId: expense?.account_id ?? "",
  toAccountId: income?.account_id ?? "",
  amount: expense ? String(expense.amount) : "",
  date: expense?.date ?? dayjs().format("YYYY-MM-DD"),
  note: "",
});

const buildAccountUpdates = ({
  oldFromId,
  oldToId,
  newFromId,
  newToId,
  oldAmount,
  newAmount,
}: {
  oldFromId: string;
  oldToId: string;
  newFromId: string;
  newToId: string;
  oldAmount: number;
  newAmount: number;
}) => {
  const deltas = new Map<string, number>();
  const add = (id: string, delta: number) => {
    if (!id) {
      return;
    }
    deltas.set(id, (deltas.get(id) ?? 0) + delta);
  };
  add(oldFromId, oldAmount);
  add(oldToId, -oldAmount);
  add(newFromId, -newAmount);
  add(newToId, newAmount);
  return deltas;
};

export const TransferDetailDrawer = ({
  opened,
  onClose,
  transferGroupId,
  transactions,
  accounts,
}: TransferDetailDrawerProps) => {
  const [form, setForm] = useState<TransferFormState>(() => buildInitialForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updateTransaction] = useUpdateTransactionMutation();
  const [updateAccount] = useUpdateAccountMutation();

  const transferTransactions = useMemo(() => {
    if (!transferGroupId) {
      return [];
    }
    return transactions.filter(
      (tx) => tx.transfer_group_id === transferGroupId && tx.is_transfer
    );
  }, [transactions, transferGroupId]);

  const expenseTx = useMemo(
    () => transferTransactions.find((tx) => tx.type === "expense") ?? null,
    [transferTransactions]
  );
  const incomeTx = useMemo(
    () => transferTransactions.find((tx) => tx.type === "income") ?? null,
    [transferTransactions]
  );

  useEffect(() => {
    if (!opened) {
      return;
    }
    setForm(buildInitialForm(expenseTx, incomeTx));
    setError(null);
  }, [opened, expenseTx, incomeTx]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${formatINR(account.current_balance ?? 0)}`,
      })),
    [accounts]
  );

  const mismatch =
    expenseTx && incomeTx && Number(expenseTx.amount) !== Number(incomeTx.amount);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    if (!transferGroupId) {
      setError("Missing transfer group.");
      return;
    }
    if (!expenseTx || !incomeTx) {
      setError("This transfer is missing a linked entry.");
      return;
    }
    if (!form.fromAccountId || !form.toAccountId) {
      setError("Select both accounts.");
      return;
    }
    if (form.fromAccountId === form.toAccountId) {
      setError("Choose two different accounts.");
      return;
    }
    const amountValue = Number(form.amount);
    if (!form.amount || Number.isNaN(amountValue) || amountValue <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!form.date) {
      setError("Select a date.");
      return;
    }
    const fromAccount = accounts.find((acc) => acc.id === form.fromAccountId);
    const toAccount = accounts.find((acc) => acc.id === form.toAccountId);
    if (!fromAccount || !toAccount) {
      setError("Accounts not found.");
      return;
    }

    const note = form.note.trim();
    const expenseNote = note ? note : expenseTx.notes ?? null;
    const incomeNote = note ? note : incomeTx.notes ?? null;
    const expenseTags = expenseTx.tags?.map((tag) => tag.name) ?? [];
    const incomeTags = incomeTx.tags?.map((tag) => tag.name) ?? [];
    const oldAmount = Number(expenseTx.amount);

    setSaving(true);
    try {
      await updateTransaction({
        id: expenseTx.id,
        type: "expense",
        date: form.date,
        amount: amountValue,
        category_id: expenseTx.category_id ?? null,
        reimbursement_category_id: expenseTx.reimbursement_category_id ?? null,
        payment_method_id: expenseTx.payment_method_id ?? null,
        account_id: form.fromAccountId,
        notes: expenseNote,
        tags: expenseTags,
        is_transfer: true,
        transfer_group_id: transferGroupId,
        is_reimbursement: false,
        is_shared: false,
        is_recurring: expenseTx.is_recurring ?? false,
        sharedSplit: null,
        sharedReimbursement: null,
      }).unwrap();
      await updateTransaction({
        id: incomeTx.id,
        type: "income",
        date: form.date,
        amount: amountValue,
        category_id: incomeTx.category_id ?? null,
        reimbursement_category_id: incomeTx.reimbursement_category_id ?? null,
        payment_method_id: incomeTx.payment_method_id ?? null,
        account_id: form.toAccountId,
        notes: incomeNote,
        tags: incomeTags,
        is_transfer: true,
        transfer_group_id: transferGroupId,
        is_reimbursement: false,
        is_shared: false,
        is_recurring: incomeTx.is_recurring ?? false,
        sharedSplit: null,
        sharedReimbursement: null,
      }).unwrap();

      const deltas = buildAccountUpdates({
        oldFromId: expenseTx.account_id ?? "",
        oldToId: incomeTx.account_id ?? "",
        newFromId: form.fromAccountId,
        newToId: form.toAccountId,
        oldAmount,
        newAmount: amountValue,
      });
      const updates = Array.from(deltas.entries())
        .map(([id, delta]) => {
          const account = accounts.find((acc) => acc.id === id);
          if (!account) {
            return null;
          }
          return {
            account,
            nextBalance: Number(account.current_balance ?? 0) + delta,
          };
        })
        .filter((item): item is { account: Account; nextBalance: number } =>
          Boolean(item)
        );

      const originals = updates.map(({ account }) => ({
        account,
        balance: Number(account.current_balance ?? 0),
      }));

      try {
        for (const update of updates) {
          await updateAccount({
            id: update.account.id,
            name: update.account.name,
            type: update.account.type,
            currency: update.account.currency,
            current_balance: update.nextBalance,
          }).unwrap();
        }
      } catch (updateError) {
        await Promise.allSettled(
          originals.map((item) =>
            updateAccount({
              id: item.account.id,
              name: item.account.name,
              type: item.account.type,
              currency: item.account.currency,
              current_balance: item.balance,
            }).unwrap()
          )
        );
        await Promise.allSettled([
          updateTransaction({
            id: expenseTx.id,
            type: expenseTx.type,
            date: expenseTx.date,
            amount: Number(expenseTx.amount),
            category_id: expenseTx.category_id ?? null,
            reimbursement_category_id: expenseTx.reimbursement_category_id ?? null,
            payment_method_id: expenseTx.payment_method_id ?? null,
            account_id: expenseTx.account_id ?? null,
            notes: expenseTx.notes ?? null,
            tags: expenseTags,
            is_transfer: true,
            transfer_group_id: transferGroupId,
            is_reimbursement: false,
            is_shared: false,
            is_recurring: expenseTx.is_recurring ?? false,
            sharedSplit: null,
            sharedReimbursement: null,
          }).unwrap(),
          updateTransaction({
            id: incomeTx.id,
            type: incomeTx.type,
            date: incomeTx.date,
            amount: Number(incomeTx.amount),
            category_id: incomeTx.category_id ?? null,
            reimbursement_category_id: incomeTx.reimbursement_category_id ?? null,
            payment_method_id: incomeTx.payment_method_id ?? null,
            account_id: incomeTx.account_id ?? null,
            notes: incomeTx.notes ?? null,
            tags: incomeTags,
            is_transfer: true,
            transfer_group_id: transferGroupId,
            is_reimbursement: false,
            is_shared: false,
            is_recurring: incomeTx.is_recurring ?? false,
            sharedSplit: null,
            sharedReimbursement: null,
          }).unwrap(),
        ]);
        throw updateError;
      }

      onClose();
    } catch {
      setError("Unable to update transfer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title="Transfer detail"
      position="right"
      size="md"
    >
      <Stack gap="sm">
        {mismatch ? (
          <Alert color="yellow" variant="light">
            This transfer has mismatched amounts across its entries. Review before
            saving.
          </Alert>
        ) : null}
        {!expenseTx || !incomeTx ? (
          <Alert color="red" variant="light">
            This transfer is missing one of its linked entries.
          </Alert>
        ) : null}
        <Select
          label="From account"
          data={accountOptions}
          value={form.fromAccountId || null}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, fromAccountId: value ?? "" }))
          }
          searchable
          required
        />
        <Select
          label="To account"
          data={accountOptions}
          value={form.toAccountId || null}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, toAccountId: value ?? "" }))
          }
          searchable
          required
        />
        <Group grow align="flex-end">
          <TextInput
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amount: event.target.value }))
            }
            placeholder="0"
            min="0"
            step="0.01"
            required
          />
          <DateInput
            label="Date"
            value={form.date ? dayjs(form.date).toDate() : null}
            onChange={(value) =>
              value &&
              setForm((prev) => ({
                ...prev,
                date: dayjs(value).format("YYYY-MM-DD"),
              }))
            }
            required
          />
        </Group>
        <Textarea
          label="Note"
          value={form.note}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, note: event.target.value }))
          }
          placeholder="Optional. Leave blank to keep existing notes."
          minRows={2}
        />
        <Text size="xs" c="dimmed">
          Note is applied to both transfer entries.
        </Text>
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Cancel
          </Button>
          <Button color="green" loading={saving} onClick={handleSave}>
            Save transfer
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
};
