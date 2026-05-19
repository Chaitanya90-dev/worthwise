import { Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import dayjs from "dayjs";
import { useState } from "react";
import {
  useAddTransactionMutation,
  useDeleteTransactionMutation,
  useUpdateAccountMutation,
} from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { formatINR } from "../../lib/format";

type PayCardModalProps = {
  opened: boolean;
  onClose: () => void;
  accounts: Account[];
  readOnly?: boolean;
};

const defaultAmountForCard = (card?: Account | null) => {
  if (!card) {
    return "";
  }
  const balance = Number(card.current_balance ?? 0);
  if (balance < 0) {
    return String(Math.abs(balance));
  }
  return "";
};

const createTransferGroupId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `transfer-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const PayCardModal = ({
  opened,
  onClose,
  accounts,
  readOnly = false,
}: PayCardModalProps) => {
  const [form, setForm] = useState({
    fromAccountId: "",
    cardAccountId: "",
    amount: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [updateAccount, { isLoading }] = useUpdateAccountMutation();
  const [addTransaction] = useAddTransactionMutation();
  const [deleteTransaction] = useDeleteTransactionMutation();

  const bankLikeAccounts = accounts.filter(
    (acc) => acc.type === "bank" || acc.type === "cash" || acc.type === "wallet"
  );
  const cardAccounts = accounts.filter((acc) => acc.type === "card");

  const handleClose = () => {
    setForm({ fromAccountId: "", cardAccountId: "", amount: "" });
    setError(null);
    onClose();
  };

  const handlePayCard = async () => {
    setError(null);
    if (readOnly) {
      setError("Demo mode is read-only. Card payments are disabled.");
      return;
    }
    const amount = form.amount ? Number(form.amount) : 0;
    if (!form.fromAccountId || !form.cardAccountId) {
      setError("Choose both accounts.");
      return;
    }
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Card payment needs internet because it updates multiple records.");
      return;
    }
    const from = accounts.find((a) => a.id === form.fromAccountId);
    const card = accounts.find((a) => a.id === form.cardAccountId);
    if (!from || !card) {
      setError("Accounts not found.");
      return;
    }
    const date = dayjs().format("YYYY-MM-DD");
    const transferGroupId = createTransferGroupId();
    const fromBalance = from.current_balance ?? 0;
    const cardBalance = card.current_balance ?? 0;
    try {
      const fromTx = await addTransaction({
        type: "expense",
        date,
        amount,
        category_id: null,
        reimbursement_category_id: null,
        payment_method_id: null,
        account_id: from.id,
        notes: `Card payment to ${card.name}`,
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
      const cardTx = await addTransaction({
        type: "income",
        date,
        amount,
        category_id: null,
        reimbursement_category_id: null,
        payment_method_id: null,
        account_id: card.id,
        notes: `Card payment from ${from.name}`,
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
          current_balance: fromBalance - amount,
        }).unwrap();
        await updateAccount({
          id: card.id,
          name: card.name,
          type: card.type,
          currency: card.currency,
          current_balance: cardBalance + amount,
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
            id: card.id,
            name: card.name,
            type: card.type,
            currency: card.currency,
            current_balance: cardBalance,
          }).unwrap(),
          deleteTransaction({ id: fromTx.id }).unwrap(),
          deleteTransaction({ id: cardTx.id }).unwrap(),
        ]);
        throw updateError;
      }
      handleClose();
    } catch {
      setError("Unable to record card payment.");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Pay credit card"
      size="md"
    >
      <Stack gap="sm">
        <Select
          label="From account (bank/cash)"
          data={bankLikeAccounts.map((acc) => ({
            value: acc.id,
            label: `${acc.name} · ${formatINR(acc.current_balance ?? 0, acc.currency)}`,
          }))}
          value={form.fromAccountId || null}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, fromAccountId: value ?? "" }))
          }
          placeholder="Select source"
        />
        <Select
          label="Card account"
          data={cardAccounts.map((acc) => ({
            value: acc.id,
            label: `${acc.name} · ${formatINR(acc.current_balance ?? 0, acc.currency)}`,
          }))}
          value={form.cardAccountId || null}
          onChange={(value) => {
            const nextId = value ?? "";
            const nextCard = accounts.find((acc) => acc.id === nextId);
            setForm((prev) => {
              if (prev.cardAccountId === nextId) {
                return prev;
              }
              return {
                ...prev,
                cardAccountId: nextId,
                amount: defaultAmountForCard(nextCard),
              };
            });
          }}
          placeholder="Select card"
        />
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
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handlePayCard}
            loading={isLoading}
            color="green"
            disabled={readOnly}
          >
            Save payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
