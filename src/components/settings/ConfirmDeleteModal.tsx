import { Button, Group, Modal, Stack, Text } from "@mantine/core";

type ConfirmDeleteModalProps = {
  opened: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export const ConfirmDeleteModal = ({
  opened,
  title,
  message,
  onClose,
  onConfirm,
  loading = false,
}: ConfirmDeleteModalProps) => (
  <Modal opened={opened} onClose={onClose} title={title} centered>
    <Stack gap="sm">
      <Text size="sm">{message}</Text>
      <Group justify="flex-end">
        <Button variant="subtle" color="gray" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={loading}>
          Delete
        </Button>
      </Group>
    </Stack>
  </Modal>
);
