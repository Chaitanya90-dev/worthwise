import {
  ActionIcon,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { Pencil, Plus, Trash } from "lucide-react";
import {
  useAddAccountMutation,
  useDeleteAccountMutation,
  useGetAccountsQuery,
  useUpdateAccountMutation,
} from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { SectionCard } from "./SectionCard";
import { TransferModal } from "./TransferModal";
import { AccountDetailsDrawer } from "./AccountDetailsDrawer";
import { PayCardModal } from "./PayCardModal";
import { useReadOnly } from "../../context/ReadOnlyContext";
import { formatINR } from "../../lib/format";
import { getBaseCurrency } from "../../lib/moneyConfig";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank (incl. debit cards)" },
  { value: "card", label: "Credit card" },
  { value: "wallet", label: "Wallet" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export const AccountManager = () => {
  const { data: accounts = [] } = useGetAccountsQuery();
  const isReadOnly = useReadOnly();
  const baseCurrency = getBaseCurrency();
  const [addAccount, { isLoading: isSaving }] = useAddAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] =
    useUpdateAccountMutation();
  const [deleteAccount, { isLoading: isDeleting }] =
    useDeleteAccountMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "bank" as Account["type"],
    current_balance: "",
    currency: baseCurrency,
  });
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setForm({ name: "", type: "bank", current_balance: "", currency: baseCurrency });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenPayCard = () => {
    setPayModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setMode("edit");
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      current_balance: String(account.current_balance ?? 0),
      currency: account.currency ?? baseCurrency,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (isReadOnly) {
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const balance = form.current_balance ? Number(form.current_balance) : 0;
    if (Number.isNaN(balance)) {
      setError("Enter a valid balance.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      current_balance: balance,
      currency: form.currency || baseCurrency,
    };
    try {
      if (mode === "edit" && editing) {
        await updateAccount({ id: editing.id, ...payload }).unwrap();
      } else {
        await addAccount(payload).unwrap();
      }
      setModalOpen(false);
    } catch {
      setError("Unable to save account.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    if (isReadOnly) return;
    await deleteAccount({ id: deleteId }).unwrap();
    setDeleteId(null);
  };

  const bankLikeAccounts = accounts.filter(
    (acc) => acc.type === "bank" || acc.type === "cash" || acc.type === "wallet"
  );
  const cardAccounts = accounts.filter((acc) => acc.type === "card");
  const selectedAccount =
    accounts.find((acc) => acc.id === detailAccountId) ?? null;

  return (
    <>
      <SectionCard
        title="Accounts"
        description="Track bank, credit card, wallet, or cash balances for coverage. Debit cards share your bank account balance."
        badge={`${accounts.length} total`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Use this to check fund coverage vs. real balances.
          </Text>
          <Group gap="xs">
            <Button
              onClick={handleOpenPayCard}
              leftSection={<Pencil size={16} strokeWidth={2} />}
              variant="light"
              disabled={
                isReadOnly || bankLikeAccounts.length === 0 || cardAccounts.length === 0
              }
            >
              Pay card
            </Button>
            <Button
              onClick={() => setTransferOpen(true)}
              leftSection={<Pencil size={16} strokeWidth={2} />}
              variant="light"
              disabled={isReadOnly || accounts.length < 2}
            >
              Transfer
            </Button>
            <Button
              onClick={openCreate}
              leftSection={<Plus size={16} strokeWidth={2} />}
              disabled={isReadOnly}
            >
              New account
            </Button>
          </Group>
        </Group>
        <ScrollArea h={220}>
          <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((account) => (
                <Table.Tr
                  key={account.id}
                  onClick={() => setDetailAccountId(account.id)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>{account.name}</Table.Td>
                  <Table.Td>{account.type}</Table.Td>
                  <Table.Td>{formatINR(account.current_balance, account.currency)}</Table.Td>
                  <Table.Td width={120}>
                    <Group gap={6} justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(account);
                        }}
                        aria-label="Edit account"
                        disabled={isReadOnly}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteId(account.id);
                        }}
                        aria-label="Delete account"
                        disabled={isReadOnly}
                      >
                        <Trash size={16} strokeWidth={2} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {accounts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed">
                      No accounts yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </SectionCard>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === "edit" ? "Edit account" : "New account"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g., HDFC Savings"
            required
          />
          <Select
            label="Type"
            data={ACCOUNT_TYPES}
            value={form.type}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, type: (value as Account["type"]) ?? "bank" }))
            }
          />
          <TextInput
            label="Current balance"
            type="number"
            value={form.current_balance}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, current_balance: event.target.value }))
            }
            placeholder="0"
            step="0.01"
          />
          <TextInput
            label="Currency"
            value={form.currency}
            onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
          />
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={isSaving || isUpdating}
              color="green"
              disabled={isReadOnly}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDeleteModal
        opened={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Delete account?"
        message="Existing transactions using this account will lose that link."
      />

      <TransferModal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
        readOnly={isReadOnly}
      />

      <AccountDetailsDrawer
        opened={Boolean(detailAccountId)}
        onClose={() => setDetailAccountId(null)}
        account={selectedAccount}
      />

      <PayCardModal
        opened={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        accounts={accounts}
        readOnly={isReadOnly}
      />
    </>
  );
};
