import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useDeleteFundMutation } from "../../features/api/apiSlice";
import type { Fund } from "../../types/finance";

type FundDeleteModalProps = {
  fund: Fund | null;
  opened: boolean;
  onClose: () => void;
};

export const FundDeleteModal = ({ fund, opened, onClose }: FundDeleteModalProps) => {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteFund, { isLoading: isDeletingFund }] = useDeleteFundMutation();

  const handleConfirmDelete = async () => {
    if (!fund) {
      return;
    }

    try {
      await deleteFund({ id: fund.id }).unwrap();
      setDeleteError(null);
      onClose();
    } catch {
      setDeleteError("Unable to delete the fund.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete fund" size="sm">
      <Stack gap="sm">
        <Text size="sm">
          Deleting{" "}
          <Text component="span" fw={600}>
            {fund?.name}
          </Text>{" "}
          will remove its contributions.
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
            loading={isDeletingFund}
            onClick={handleConfirmDelete}
          >
            Delete fund
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
