import { Button, Checkbox, Group, Modal, Paper, Stack, Text } from "@mantine/core";

export type DashboardPinOption = {
  id: string;
  label: string;
  description: string;
};

type DashboardPinsModalProps = {
  opened: boolean;
  onClose: () => void;
  options: DashboardPinOption[];
  pinnedIds: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
};

export const DashboardPinsModal = ({
  opened,
  onClose,
  options,
  pinnedIds,
  onToggle,
  onReset,
}: DashboardPinsModalProps) => {
  const pinnedCount = pinnedIds.length;
  const totalCount = options.length;

  return (
    <Modal opened={opened} onClose={onClose} title="Customize pinned cards" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Choose which cards appear at the top of your dashboard. Your picks are saved to this
          device.
        </Text>
        <Stack gap="xs">
          {options.map((option) => {
            const checked = pinnedIds.includes(option.id);
            return (
              <Paper
                key={option.id}
                withBorder
                radius="md"
                p="sm"
                style={{ background: "var(--surface-alt)" }}
              >
                <Checkbox
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                  label={
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {option.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {option.description}
                      </Text>
                    </Stack>
                  }
                />
              </Paper>
            );
          })}
        </Stack>
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="xs" c="dimmed">
            {pinnedCount} of {totalCount} cards pinned
          </Text>
          <Group gap="xs">
            <Button variant="subtle" color="gray" size="xs" onClick={onReset}>
              Reset defaults
            </Button>
            <Button size="xs" onClick={onClose}>
              Done
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
