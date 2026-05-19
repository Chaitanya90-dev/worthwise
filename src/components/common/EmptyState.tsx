import { Button, Paper, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";

type EmptyStateAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "light" | "subtle" | "filled";
  color?: string;
};

type EmptyStateProps = {
  title?: string;
  description: string;
  action?: EmptyStateAction;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        background: "var(--surface-alt)",
      }}
    >
      <Stack gap="xs" align="flex-start">
        {title ? (
          <Text size="sm" fw={700}>
            {title}
          </Text>
        ) : null}
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        {action?.to ? (
          <Button
            component={Link}
            to={action.to}
            variant={action.variant ?? "light"}
            color={action.color ?? "blue"}
            size="xs"
          >
            {action.label}
          </Button>
        ) : action ? (
          <Button
            onClick={action.onClick}
            variant={action.variant ?? "light"}
            color={action.color ?? "blue"}
            size="xs"
          >
            {action.label}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
};
