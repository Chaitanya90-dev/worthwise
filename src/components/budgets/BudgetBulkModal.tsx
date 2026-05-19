import {
  Alert,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { formatMonthLabel } from "../../lib/format";
import type { Budget, Category } from "../../types/finance";
import { useUpsertBudgetsMutation } from "../../features/api/apiSlice";

type BudgetBulkModalProps = {
  opened: boolean;
  onClose: () => void;
  month: string;
  categories: Category[];
  budgets: Budget[];
  readOnly?: boolean;
};

export const BudgetBulkModal = ({
  opened,
  onClose,
  month,
  categories,
  budgets,
  readOnly = false,
}: BudgetBulkModalProps) => {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [overallAmount, setOverallAmount] = useState<string>("");
  const [rolloverFlags, setRolloverFlags] = useState<Record<string, boolean>>({});
  const [overallRollover, setOverallRollover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsertBudgets, { isLoading }] = useUpsertBudgetsMutation();

  const takenCategoryIds = useMemo(
    () =>
      new Set(budgets.filter((b) => b.category_id).map((b) => b.category_id!)),
    [budgets]
  );
  const hasOverallBudget = useMemo(
    () => budgets.some((b) => !b.category_id),
    [budgets]
  );

  const availableCategories = useMemo(
    () => categories.filter((cat) => !takenCategoryIds.has(cat.id)),
    [categories, takenCategoryIds]
  );

  const handleChangeAmount = (categoryId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleToggleRollover = (categoryId: string, checked: boolean) => {
    setRolloverFlags((prev) => ({ ...prev, [categoryId]: checked }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (readOnly) {
      return;
    }
    const entries: Array<{
      category_id: string | null;
      amount: number;
      rollover_enabled: boolean;
    }> = [];

    if (!hasOverallBudget) {
      const overall = Number.parseFloat(overallAmount);
      if (!Number.isNaN(overall) && overall > 0) {
        entries.push({
          category_id: null,
          amount: overall,
          rollover_enabled: overallRollover,
        });
      }
    }

    availableCategories.forEach((cat) => {
      const value = amounts[cat.id];
      if (!value) {
        return;
      }
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed) && parsed > 0) {
        entries.push({
          category_id: cat.id,
          amount: parsed,
          rollover_enabled: rolloverFlags[cat.id] ?? false,
        });
      }
    });

    if (entries.length === 0) {
      setError("Enter at least one budget amount.");
      return;
    }

    try {
      await upsertBudgets({ month, items: entries }).unwrap();
      setAmounts({});
      setOverallAmount("");
      setRolloverFlags({});
      setOverallRollover(false);
      onClose();
    } catch {
      setError("Unable to save budgets. Please try again.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Bulk add budgets" size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Month: {formatMonthLabel(month)}
        </Text>
        {hasOverallBudget ? (
          <Text size="xs" c="dimmed">
            Overall budget already set. Add category amounts below.
          </Text>
        ) : (
          <>
            <TextInput
              label="Overall budget"
              placeholder="0"
              type="number"
              value={overallAmount}
              onChange={(event) => setOverallAmount(event.target.value)}
              min="0"
              step="0.01"
            />
            <Switch
              checked={overallRollover}
              onChange={(event) => setOverallRollover(event.currentTarget.checked)}
              label="Carry over unused overall amount"
              size="sm"
            />
          </>
        )}

        <ScrollArea h={320}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th style={{ width: 160 }}>Amount</Table.Th>
                <Table.Th style={{ width: 140 }}>Rollover</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {availableCategories.map((category) => (
                <Table.Tr key={category.id}>
                  <Table.Td>{category.name}</Table.Td>
                  <Table.Td>
                    <TextInput
                      type="number"
                      placeholder="0"
                      value={amounts[category.id] ?? ""}
                      onChange={(event) =>
                        handleChangeAmount(category.id, event.target.value)
                      }
                      min="0"
                      step="0.01"
                      size="sm"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={rolloverFlags[category.id] ?? false}
                      onChange={(event) =>
                        handleToggleRollover(category.id, event.currentTarget.checked)
                      }
                      size="sm"
                      aria-label={`Carry over unused amount for ${category.name}`}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
              {availableCategories.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text size="sm" c="dimmed">
                      All categories already have a budget for this month.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isLoading}
            color="green"
            disabled={readOnly}
          >
            Save budgets
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
