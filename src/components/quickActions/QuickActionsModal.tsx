import {
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { ArrowUpRight, Zap } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QUICK_ACTIONS } from "../../lib/quickActions";

type QuickActionsModalProps = {
  opened: boolean;
  onClose: () => void;
};

export const QuickActionsModal = ({
  opened,
  onClose,
}: QuickActionsModalProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!opened) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      const match = QUICK_ACTIONS.find(
        (action) => action.shortcutKey === event.key
      );
      if (!match) {
        return;
      }
      event.preventDefault();
      onClose();
      navigate(match.to);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [navigate, onClose, opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Quick actions" size="lg">
      <Stack gap="sm">
        <Group gap="xs" align="center">
          <Zap size={16} />
          <Title order={5}>Jump to a task</Title>
        </Group>
        <Text size="sm" c="dimmed">
          Press the number keys 1–5 to launch an action instantly.
        </Text>
        <Stack gap="sm">
          {QUICK_ACTIONS.map((action) => (
            <Paper
              key={action.id}
              withBorder
              radius="md"
              p="sm"
              style={{ background: "var(--surface-alt)" }}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="sm" align="center" wrap="nowrap">
                  <Button variant="light" size="xs" radius="xl">
                    {action.shortcutLabel}
                  </Button>
                  <Stack gap={2}>
                    <Text fw={600}>{action.label}</Text>
                    <Text size="xs" c="dimmed">
                      {action.description}
                    </Text>
                  </Stack>
                </Group>
                <Button
                  component={Link}
                  to={action.to}
                  variant="light"
                  size="xs"
                  rightSection={<ArrowUpRight size={14} />}
                  onClick={onClose}
                >
                  Open
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Modal>
  );
};
