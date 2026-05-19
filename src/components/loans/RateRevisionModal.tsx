import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAddLoanRateRevisionMutation } from "../../features/api/apiSlice";
import { formatINR } from "../../lib/format";
import { estimateLoanRateRevisionImpact } from "../../lib/loans";
import type { Loan, LoanScheduleItem } from "../../types/finance";

type RateRevisionModalProps = {
  opened: boolean;
  onClose: () => void;
  loan: Loan | null;
  scheduleRows: LoanScheduleItem[];
  readOnly?: boolean;
};

const buildInitialState = (loan: Loan | null) => ({
  effective_date: dayjs().format("YYYY-MM-DD"),
  new_rate: loan ? String(loan.rate_current) : "",
  note: "",
  regenerate_schedule: true,
});

export const RateRevisionModal = ({
  opened,
  onClose,
  loan,
  scheduleRows,
  readOnly = false,
}: RateRevisionModalProps) => {
  const [form, setForm] = useState(() => buildInitialState(loan));
  const [error, setError] = useState<string | null>(null);
  const [addLoanRateRevision, { isLoading }] = useAddLoanRateRevisionMutation();
  const impact = useMemo(() => {
    if (!loan) {
      return null;
    }
    const revisedRate = Number(form.new_rate);
    if (Number.isNaN(revisedRate) || revisedRate < 0) {
      return null;
    }

    const impact = estimateLoanRateRevisionImpact({
      currentOutstanding: loan.principal_outstanding,
      currentRate: loan.rate_current,
      revisedRate,
      currentEmi: loan.emi_amount,
      fallbackTenureMonths: loan.tenure_months,
      fallbackFirstDueDate: loan.first_due_date,
      scheduleRows: scheduleRows.filter((row) => row.loan_id === loan.id),
    });
    const currentPayoffLabel = impact.currentPayoffDate
      ? dayjs(impact.currentPayoffDate).format("MMM YYYY")
      : "Not amortizing";
    const revisedPayoffLabel = impact.revisedPayoffDate
      ? dayjs(impact.revisedPayoffDate).format("MMM YYYY")
      : "Not amortizing";
    const payoffDeltaMonths = impact.payoffDeltaMonths;

    let payoffDeltaLabel = "No payoff change";
    if (payoffDeltaMonths !== null) {
      if (payoffDeltaMonths > 0) {
        payoffDeltaLabel = `~${payoffDeltaMonths} month${
          payoffDeltaMonths === 1 ? "" : "s"
        } later`;
      } else if (payoffDeltaMonths < 0) {
        const months = Math.abs(payoffDeltaMonths);
        payoffDeltaLabel = `~${months} month${months === 1 ? "" : "s"} earlier`;
      }
    } else {
      payoffDeltaLabel = "Payoff not reachable with current EMI";
    }

    return {
      revisedRate,
      currentEmi: impact.currentEmi,
      revisedEmi: impact.revisedEmi,
      remainingInstallments: impact.remainingInstallments,
      currentPayoffDate: impact.currentPayoffDate,
      currentOutstanding: loan.principal_outstanding,
      currentPayoffLabel,
      revisedPayoffLabel,
      payoffDeltaMonths,
      payoffDeltaLabel,
    };
  }, [form.new_rate, loan, scheduleRows]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!loan) {
      setError("Missing loan context.");
      return;
    }
    if (readOnly) {
      setError("Demo mode is read-only. Changes are disabled.");
      return;
    }
    if (!form.effective_date) {
      setError("Select an effective date.");
      return;
    }
    const newRate = Number(form.new_rate);
    if (Number.isNaN(newRate) || newRate < 0) {
      setError("Enter a valid revised rate.");
      return;
    }
    if (Math.abs(newRate - loan.rate_current) < 0.0001) {
      setError("New rate is same as current rate.");
      return;
    }

    try {
      await addLoanRateRevision({
        loan_id: loan.id,
        effective_date: form.effective_date,
        new_rate: newRate,
        note: form.note.trim() ? form.note.trim() : null,
        regenerate_schedule: form.regenerate_schedule,
      }).unwrap();
      onClose();
    } catch {
      setError("Unable to revise loan rate.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Revise interest rate" size="md">
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        <TextInput label="Loan" value={loan?.name ?? "-"} readOnly />
        <TextInput label="Current rate (%)" value={String(loan?.rate_current ?? "-")} readOnly />
        <DateInput
          label="Effective date"
          value={form.effective_date ? dayjs(form.effective_date).toDate() : null}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              effective_date: value ? dayjs(value).format("YYYY-MM-DD") : "",
            }))
          }
          required
        />
        <TextInput
          label="New rate (%)"
          type="number"
          min="0"
          step="0.0001"
          value={form.new_rate}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, new_rate: event.target.value }))
          }
          required
        />
        {impact ? (
          <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" align="center" mb={6}>
              <Text fw={600} size="sm">
                Rate revision impact
              </Text>
              <Badge variant="light" color="blue" radius="sm">
                Preview
              </Badge>
            </Group>
            <Group grow gap="xs" align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Current EMI
                </Text>
                <Text fw={700}>{formatINR(impact.currentEmi)}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Est. EMI @ {impact.revisedRate.toFixed(2)}%
                </Text>
                <Text fw={700} c={impact.revisedEmi > impact.currentEmi ? "orange.7" : "teal.7"}>
                  {formatINR(impact.revisedEmi)}
                </Text>
              </Stack>
            </Group>
            <Group grow gap="xs" mt={6} align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Payoff at current rate
                </Text>
                <Text fw={600}>{impact.currentPayoffLabel}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Payoff at revised rate
                </Text>
                <Text fw={600}>{impact.revisedPayoffLabel}</Text>
              </Stack>
            </Group>
            <Text
              size="sm"
              mt={8}
              fw={600}
              c={
                impact.payoffDeltaMonths === null
                  ? "orange.7"
                  : impact.payoffDeltaMonths > 0
                  ? "orange.7"
                  : impact.payoffDeltaMonths < 0
                  ? "teal.7"
                  : "dimmed"
              }
            >
              {impact.payoffDeltaLabel}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Payoff estimate assumes outstanding {formatINR(impact.currentOutstanding)} and
              current EMI {formatINR(impact.currentEmi)} over {impact.remainingInstallments}{" "}
              remaining installment{impact.remainingInstallments === 1 ? "" : "s"}.
            </Text>
          </Paper>
        ) : null}
        <Switch
          label="Regenerate upcoming schedule with revised rate"
          description="Paid rows remain untouched; pending rows are recalculated."
          checked={form.regenerate_schedule}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              regenerate_schedule: event.currentTarget.checked,
            }))
          }
        />
        <Textarea
          label="Reason / note"
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          minRows={2}
          placeholder="e.g. repo-linked floating revision"
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
          <Button type="submit" color="green" loading={isLoading} disabled={readOnly}>
            Save revision
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
