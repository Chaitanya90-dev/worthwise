import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import dayjs from "dayjs";
import { useState } from "react";
import {
  useAddTransactionMutation,
  useDeleteTransactionMutation,
  useUpdateAccountMutation,
} from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { formatINR } from "../../lib/format";

type TransferModalProps = {
  opened: boolean;
  onClose: () => void;
  accounts: Account[];
  readOnly?: boolean;
};

export const TransferModal = ({
  opened,
  onClose,
  accounts,
  readOnly = false,
}: TransferModalProps) => {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [updateAccount, { isLoading }] = useUpdateAccountMutation();
  const [addTransaction] = useAddTransactionMutation();
  const [deleteTransaction] = useDeleteTransactionMutation();

  const createTransferGroupId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `transfer-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const handleTransfer = async () => {
    setError(null);
    if (readOnly) {
      setError("Demo mode is read-only. Transfers are disabled.");
      return;
    }
    const parsed = Number(amount);
    if (!fromId || !toId || fromId === toId) {
      setError("Choose distinct source and destination accounts.");
      return;
    }
    if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Transfers need internet because they update multiple records.");
      return;
    }
    const from = accounts.find((acc) => acc.id === fromId);
    const to = accounts.find((acc) => acc.id === toId);
    if (!from || !to) {
      setError("Accounts not found.");
      return;
    }
    try {
      const date = dayjs().format("YYYY-MM-DD");
      const transferGroupId = createTransferGroupId();
      const fromBalance = from.current_balance ?? 0;
      const toBalance = to.current_balance ?? 0;
      const fromTx = await addTransaction({
        type: "expense",
        date,
        amount: parsed,
        category_id: null,
        reimbursement_category_id: null,
        payment_method_id: null,
        account_id: from.id,
        notes: `Transfer to ${to.name}`,
        tags: [],
        offlineQueue: "disallow",
        is_transfer: true,
        transfer_group_id: transferGroupId,
        is_reimbursement: false,
        is_shared: false,
        is_recurring: false,
        sharedSplit: null,
        sharedReimbursement: null,
      }).unwrap();
      const toTx = await addTransaction({
        type: "income",
        date,
        amount: parsed,
        category_id: null,
        reimbursement_category_id: null,
        payment_method_id: null,
        account_id: to.id,
        notes: `Transfer from ${from.name}`,
        tags: [],
        offlineQueue: "disallow",
        is_transfer: true,
        transfer_group_id: transferGroupId,
        is_reimbursement: false,
        is_shared: false,
        is_recurring: false,
        sharedSplit: null,
        sharedReimbursement: null,
      }).unwrap();

      try {
        await updateAccount({
          id: from.id,
          name: from.name,
          type: from.type,
          currency: from.currency,
          current_balance: fromBalance - parsed,
        }).unwrap();
        await updateAccount({
          id: to.id,
          name: to.name,
          type: to.type,
          currency: to.currency,
          current_balance: toBalance + parsed,
        }).unwrap();
      } catch (updateError) {
        await Promise.allSettled([
          updateAccount({
            id: from.id,
            name: from.name,
            type: from.type,
            currency: from.currency,
            current_balance: fromBalance,
          }).unwrap(),
          updateAccount({
            id: to.id,
            name: to.name,
            type: to.type,
            currency: to.currency,
            current_balance: toBalance,
          }).unwrap(),
          deleteTransaction({ id: fromTx.id }).unwrap(),
          deleteTransaction({ id: toTx.id }).unwrap(),
        ]);
        throw updateError;
      }
      onClose();
      setFromId("");
      setToId("");
      setAmount("");
    } catch {
      setError("Unable to complete transfer.");
    }
  };

  const accountOptions = accounts.map((acc) => ({
    value: acc.id,
    label: `${acc.name} · ${acc.type} (${formatINR(acc.current_balance ?? 0, acc.currency)})`,
  }));

  return (
    <Modal opened={opened} onClose={onClose} title="Transfer" size="md">
      <Stack gap="sm">
        <Select
          label="From account"
          data={accountOptions}
          value={fromId || null}
          onChange={(value) => setFromId(value ?? "")}
          searchable
        />
        <Select
          label="To account"
          data={accountOptions}
          value={toId || null}
          onChange={(value) => setToId(value ?? "")}
          searchable
        />
        <TextInput
          label="Amount"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
          min="0"
          step="0.01"
        />
        <Text size="xs" c="dimmed">
          This records a transfer entry for both accounts.
        </Text>
        {readOnly ? (
          <Text size="xs" c="orange">
            Demo mode: changes are disabled.
          </Text>
        ) : null}
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="green"
            onClick={handleTransfer}
            loading={isLoading}
            disabled={readOnly}
          >
            Transfer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
