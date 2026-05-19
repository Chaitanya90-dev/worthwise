import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  useAddBudgetMutation,
  useUpdateBudgetMutation,
} from "../../features/api/apiSlice";
import { formatMonthLabel } from "../../lib/format";
import type { Budget, Category } from "../../types/finance";

type BudgetFormModalProps = {
  opened: boolean;
  onClose: () => void;
  month: string;
  categories: Category[];
  budget?: Budget | null;
  onRequestDelete?: () => void;
  takenCategoryIds?: Set<string>;
  hasOverallBudget?: boolean;
  readOnly?: boolean;
};

const buildInitialForm = (budget?: Budget | null) => ({
  category_id: budget?.category_id ?? "",
  amount: budget ? String(budget.amount) : "",
  rollover_enabled: budget?.rollover_enabled ?? false,
});

export const BudgetFormModal = ({
  opened,
  onClose,
  month,
  categories,
  budget,
  onRequestDelete,
  takenCategoryIds,
  hasOverallBudget = false,
  readOnly = false,
}: BudgetFormModalProps) => {
  const mode = budget ? "edit" : "create";
  const [form, setForm] = useState(() => buildInitialForm(budget));
  const [error, setError] = useState<string | null>(null);
  const [addBudget, { isLoading: isSaving }] = useAddBudgetMutation();
  const [updateBudget, { isLoading: isUpdating }] = useUpdateBudgetMutation();

  const categoryOptions = useMemo(() => {
    const options = categories.map((category) => ({
      value: category.id,
      label: category.name,
      disabled:
        !budget && takenCategoryIds?.has(category.id ?? "") ? true : undefined,
    }));
    return options;
  }, [categories, budget, takenCategoryIds]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (readOnly) {
      return;
    }

    if (!form.amount || Number.isNaN(Number(form.amount))) {
      setError("Enter a valid budget amount.");
      return;
    }

    if (!budget && !form.category_id && hasOverallBudget) {
      setError("Overall budget already exists for this month.");
      return;
    }

    if (!budget && form.category_id && takenCategoryIds?.has(form.category_id)) {
      setError("Budget already exists for this category.");
      return;
    }

    try {
      const payload = {
        month,
        category_id: form.category_id || null,
        amount: Number(form.amount),
        rollover_enabled: form.rollover_enabled,
      };

      if (budget?.id) {
        await updateBudget({ id: budget.id, ...payload }).unwrap();
      } else {
        await addBudget(payload).unwrap();
      }

      onClose();
    } catch {
      setError(mode === "edit" ? "Unable to update the budget." : "Unable to save the budget.");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === "edit" ? "Edit budget" : "Set budget"}
      size="md"
    >
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        <Text size="sm" c="dimmed">
          Budget month: {formatMonthLabel(month)}
        </Text>
        {mode === "edit" ? (
          <Text size="xs" c="dimmed">
            Category is locked while editing.
          </Text>
        ) : null}
        <Select
          label="Category"
          data={categoryOptions}
          value={form.category_id || null}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, category_id: value ?? "" }))
          }
          placeholder="All categories"
          clearable
          disabled={mode === "edit"}
        />
        <TextInput
          label="Amount"
          type="number"
          value={form.amount}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, amount: event.target.value }))
          }
          min="0"
          step="0.01"
          placeholder="0"
          required
        />
        <Switch
          checked={form.rollover_enabled}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              rollover_enabled: event.currentTarget.checked,
            }))
          }
          label="Carry over unused amount"
          description="Adds last month's leftover to this budget."
        />
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          {mode === "edit" && onRequestDelete ? (
            <Button
              variant="light"
              color="red"
              onClick={onRequestDelete}
              disabled={readOnly}
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="submit"
            loading={isSaving || isUpdating}
            color="green"
            disabled={readOnly}
          >
            {mode === "edit" ? "Update budget" : "Save budget"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
