import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useState } from "react";
import { useDeleteBudgetMutation } from "../../features/api/apiSlice";
import { formatINR } from "../../lib/format";
import type { Budget } from "../../types/finance";

type BudgetDeleteModalProps = {
  opened: boolean;
  onClose: () => void;
  budget?: Budget | null;
  categoryName: string;
};

export const BudgetDeleteModal = ({
  opened,
  onClose,
  budget,
  categoryName,
}: BudgetDeleteModalProps) => {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBudget, { isLoading }] = useDeleteBudgetMutation();

  const handleConfirmDelete = async () => {
    if (!budget) {
      return;
    }

    try {
      await deleteBudget({ id: budget.id }).unwrap();
      onClose();
    } catch {
      setDeleteError("Unable to delete the budget.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete budget" size="sm">
      <Stack gap="sm">
        <Text size="sm">
          Delete the{" "}
          <Text component="span" fw={600}>
            {formatINR(budget?.amount ?? 0)}
          </Text>{" "}
          budget for{" "}
          <Text component="span" fw={600}>
            {categoryName}
          </Text>
          ?
        </Text>
        {deleteError ? (
          <Alert color="red" variant="light">
            {deleteError}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={isLoading}
            onClick={handleConfirmDelete}
            disabled={!budget}
          >
            Delete budget
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
