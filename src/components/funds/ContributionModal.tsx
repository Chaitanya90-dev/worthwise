import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import dayjs from "dayjs";
import {
  useAddFundContributionMutation,
  useDeleteFundContributionMutation,
  useUpdateFundContributionMutation,
} from "../../features/api/apiSlice";
import type { Fund, FundContribution } from "../../types/finance";
import {
  CONTRIBUTION_TYPES,
  type ContributionKind,
} from "../../lib/fundOptions";
import { formatINR } from "../../lib/format";

type ContributionModalProps = {
  opened: boolean;
  onClose: () => void;
  funds: Fund[];
  unallocatedCash: number;
  contribution?: FundContribution | null;
  readOnly?: boolean;
};

const buildInitialForm = (
  contribution: FundContribution | null | undefined,
  funds: Fund[]
) => ({
  fund_id: contribution?.fund_id ?? funds[0]?.id ?? "",
  date: contribution?.date ?? dayjs().format("YYYY-MM-DD"),
  amount: contribution ? String(Math.abs(contribution.amount)) : "",
  note: contribution?.note ?? "",
  type: contribution && contribution.amount < 0 ? "withdrawal" : "deposit",
});

export const ContributionModal = ({
  opened,
  onClose,
  funds,
  unallocatedCash,
  contribution,
  readOnly = false,
}: ContributionModalProps) => {
  const [form, setForm] = useState(() => buildInitialForm(contribution, funds));
  const [error, setError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [addContribution, { isLoading: isSaving }] =
    useAddFundContributionMutation();
  const [updateContribution, { isLoading: isUpdating }] =
    useUpdateFundContributionMutation();
  const [deleteContribution, { isLoading: isDeleting }] =
    useDeleteFundContributionMutation();

  const fundOptions = useMemo(
    () => funds.map((fund) => ({ value: fund.id, label: fund.name })),
    [funds]
  );
  const fundMap = useMemo(
    () => new Map(funds.map((fund) => [fund.id, fund])),
    [funds]
  );
  const availableLabel =
    unallocatedCash >= 0
      ? `Unallocated cash ${formatINR(unallocatedCash)}`
      : `Over-allocated by ${formatINR(Math.abs(unallocatedCash))}`;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (readOnly) {
      return;
    }

    if (!form.fund_id) {
      setError("Select a fund.");
      return;
    }

    const parsedAmount = Math.abs(Number(form.amount));
    if (!form.amount || Number.isNaN(parsedAmount)) {
      setError("Enter a valid contribution amount.");
      return;
    }

    if (parsedAmount <= 0) {
      setError("Contribution amount must be greater than 0.");
      return;
    }

    const signedAmount =
      form.type === "withdrawal" ? -parsedAmount : parsedAmount;
    const selectedFund = fundMap.get(form.fund_id);

    if (!selectedFund) {
      setError("Select a valid fund.");
      return;
    }

    if (contribution) {
      const allocationDelta = signedAmount - contribution.amount;
      if (allocationDelta > 0 && allocationDelta - unallocatedCash > 0.01) {
        setError(
          `Not enough unallocated cash. ${availableLabel}.`
        );
        return;
      }
      if (contribution.fund_id === form.fund_id) {
        const nextCurrent =
          selectedFund.current_amount + (signedAmount - contribution.amount);
        if (nextCurrent < 0) {
          setError("This change would make the fund balance negative.");
          return;
        }
      } else {
        const previousFund = fundMap.get(contribution.fund_id);
        if (previousFund) {
          const previousNext =
            previousFund.current_amount - contribution.amount;
          if (previousNext < 0) {
            setError(
              "This change would make the previous fund balance negative."
            );
            return;
          }
        }
        const nextCurrent = selectedFund.current_amount + signedAmount;
        if (nextCurrent < 0) {
          setError("This change would make the new fund balance negative.");
          return;
        }
      }
    } else {
      if (signedAmount > 0 && signedAmount - unallocatedCash > 0.01) {
        setError(
          `Not enough unallocated cash. ${availableLabel}.`
        );
        return;
      }
      const nextCurrent = selectedFund.current_amount + signedAmount;
      if (nextCurrent < 0) {
        setError("This contribution would overdraw the fund.");
        return;
      }
    }

    try {
      if (contribution?.id) {
        await updateContribution({
          id: contribution.id,
          fund_id: form.fund_id,
          date: form.date,
          amount: signedAmount,
          note: form.note.trim() ? form.note.trim() : null,
        }).unwrap();
      } else {
        await addContribution({
          fund_id: form.fund_id,
          date: form.date,
          amount: signedAmount,
          note: form.note.trim() ? form.note.trim() : null,
        }).unwrap();
      }

      onClose();
    } catch {
      setError(
        contribution?.id
          ? "Unable to update the contribution."
          : "Unable to save the contribution."
      );
    }
  };

  const handleOpenDelete = () => {
    if (!contribution) {
      return;
    }
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleCloseDelete = () => {
    setIsDeleteOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!contribution) {
      return;
    }
    if (readOnly) {
      return;
    }

    try {
      await deleteContribution({ id: contribution.id }).unwrap();
      setDeleteError(null);
      setIsDeleteOpen(false);
      onClose();
    } catch {
      setDeleteError("Unable to delete the contribution.");
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={contribution?.id ? "Edit contribution" : "Add contribution"}
        size="md"
      >
        <Stack component="form" gap="sm" onSubmit={handleSubmit}>
          <Select
            label="Fund"
            data={fundOptions}
            value={form.fund_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, fund_id: value ?? "" }))
            }
            placeholder="Choose fund"
            clearable
            required
          />
          {fundOptions.length === 0 ? (
            <Text size="xs" c="dimmed">
              Create a fund first to log contributions.
            </Text>
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <DateInput
              label="Date"
              value={dayjs(form.date).toDate()}
              onChange={(value) =>
                value &&
                setForm((prev) => ({
                  ...prev,
                  date: dayjs(value).format("YYYY-MM-DD"),
                }))
              }
              required
            />
            <Select
              label="Type"
              data={CONTRIBUTION_TYPES}
              value={form.type}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  type: (value ?? "deposit") as ContributionKind,
                }))
              }
              allowDeselect={false}
            />
            <TextInput
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, amount: event.target.value }))
              }
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </SimpleGrid>
          <Text size="xs" c={unallocatedCash >= 0 ? "dimmed" : "red.6"}>
            {availableLabel}
          </Text>
          <TextInput
            label="Note"
            value={form.note}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, note: event.target.value }))
            }
            placeholder="Optional detail"
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
            {contribution?.id ? (
              <Button
                variant="light"
                color="red"
                onClick={handleOpenDelete}
                disabled={readOnly}
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="submit"
              loading={isSaving || isUpdating}
              disabled={fundOptions.length === 0 || readOnly}
              color="green"
            >
              {contribution?.id ? "Save changes" : "Add contribution"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isDeleteOpen}
        onClose={handleCloseDelete}
        title="Delete contribution"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            Delete the{" "}
            <Text component="span" fw={600}>
              {formatINR(Math.abs(contribution?.amount ?? 0))}
            </Text>{" "}
            entry?
          </Text>
          {deleteError ? (
            <Alert color="red" variant="light">
              {deleteError}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={handleCloseDelete}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={isDeleting}
              onClick={handleConfirmDelete}
              disabled={readOnly}
            >
              Delete contribution
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
