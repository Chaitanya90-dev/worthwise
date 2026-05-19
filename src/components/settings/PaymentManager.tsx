import {
  ActionIcon,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { Pencil, Plus, Trash } from "lucide-react";
import {
  useAddPaymentMethodMutation,
  useDeletePaymentMethodMutation,
  useGetPaymentMethodsQuery,
  useUpdatePaymentMethodMutation,
} from "../../features/api/apiSlice";
import type { PaymentMethod } from "../../types/finance";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { SectionCard } from "./SectionCard";
import { useReadOnly } from "../../context/ReadOnlyContext";

export const PaymentManager = () => {
  const { data: payments = [] } = useGetPaymentMethodsQuery();
  const isReadOnly = useReadOnly();
  const [addPayment, { isLoading: isSaving }] = useAddPaymentMethodMutation();
  const [updatePayment, { isLoading: isUpdating }] =
    useUpdatePaymentMethodMutation();
  const [deletePayment, { isLoading: isDeleting }] =
    useDeletePaymentMethodMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setName("");
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (payment: PaymentMethod) => {
    setMode("edit");
    setEditing(payment);
    setName(payment.name);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (isReadOnly) {
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const payload = { name: name.trim() };
    try {
      if (mode === "edit" && editing) {
        await updatePayment({ id: editing.id, ...payload }).unwrap();
      } else {
        await addPayment(payload).unwrap();
      }
      setModalOpen(false);
    } catch {
      setError("Unable to save payment method.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    if (isReadOnly) return;
    await deletePayment({ id: deleteId }).unwrap();
    setDeleteId(null);
  };

  return (
    <>
      <SectionCard
        title="Payment methods"
        description="Channels like UPI, POS, cash handoff; accounts hold balances."
        badge={`${payments.length} total`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Keep names short (e.g., HDFC CC, UPI, Cash).
          </Text>
          <Button
            onClick={openCreate}
            leftSection={<Plus size={16} strokeWidth={2} />}
            disabled={isReadOnly}
          >
            New payment method
          </Button>
        </Group>
        <ScrollArea h={200}>
          <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {payments.map((payment) => (
                <Table.Tr key={payment.id}>
                  <Table.Td>{payment.name}</Table.Td>
                  <Table.Td width={120}>
                    <Group gap={6} justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEdit(payment)}
                        aria-label="Edit payment method"
                        disabled={isReadOnly}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteId(payment.id)}
                        aria-label="Delete payment method"
                        disabled={isReadOnly}
                      >
                        <Trash size={16} strokeWidth={2} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {payments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text size="sm" c="dimmed">
                      No payment methods yet.
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
        title={mode === "edit" ? "Edit payment method" : "New payment method"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., HDFC CC"
            required
          />
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
        title="Delete payment method?"
        message="Existing transactions using this payment method will lose that link."
      />
    </>
  );
};
