import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { appPath } from "../../app/paths";
import { EmptyState } from "../common/EmptyState";
import { formatINR } from "../../lib/format";
import type { BudgetWarning } from "../../lib/dashboard";

type SoftCapAlertsProps = {
  warnings: BudgetWarning[];
  hasBudgets: boolean;
  style?: React.CSSProperties;
};

export const SoftCapAlerts = ({ warnings, hasBudgets, style }: SoftCapAlertsProps) => (
  <Paper
    withBorder
    shadow="sm"
    radius="lg"
    p="md"
    style={{ display: "flex", flexDirection: "column", ...style }}
  >
    <Group justify="space-between" align="center" mb="md" wrap="wrap">
      <Stack gap={2}>
        <Title order={4}>Soft-cap alerts</Title>
        <Text size="sm" c="dimmed">
          Top categories nearing limits.
        </Text>
      </Stack>
      <Badge variant="light" color="blue">
        {warnings.length} active
      </Badge>
    </Group>
    {!hasBudgets && (
      <EmptyState
        description="Set budgets to activate alerts."
        action={{ label: "Set budgets", to: appPath("/budgets") }}
      />
    )}
    {hasBudgets && warnings.length === 0 && (
      <EmptyState description="All clear. No caps near limit yet." />
    )}
    {hasBudgets && warnings.length > 0 && (
      <Stack gap="sm">
        {warnings.slice(0, 3).map((warning, index) => {
          const over = warning.spent > warning.budget;
          const atLimit = !over && Math.abs(warning.budget - warning.spent) < 0.01;
          const percent = Math.round(warning.ratio * 100);
          const delta = Math.max(0, warning.spent - warning.budget);
          let statusLabel = `${percent}% used`;

          if (over) {
            statusLabel = `${formatINR(delta)} over`;
          } else if (atLimit) {
            statusLabel = "At limit";
          }

          return (
            <Paper
              key={`${warning.label}-${index}`}
              withBorder
              radius="md"
              p="sm"
              style={{ background: "var(--surface-alt)" }}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {warning.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatINR(warning.spent)} of {formatINR(warning.budget)}
                  </Text>
                </Stack>
                <Text size="sm" fw={600} c={over ? "red.6" : "brand.6"}>
                  {statusLabel}
                </Text>
              </Group>
            </Paper>
          );
        })}
        <Group justify="space-between" align="center" wrap="wrap">
          {warnings.length > 3 ? (
            <Text size="xs" c="dimmed">
              {warnings.length - 3} more categories in Budgets
            </Text>
          ) : (
            <Text size="xs" c="dimmed">
              Review full budget progress in Budgets.
            </Text>
          )}
          <Button component={Link} to={appPath("/budgets")} variant="subtle" size="xs">
            View budgets
          </Button>
        </Group>
      </Stack>
    )}
  </Paper>
);
