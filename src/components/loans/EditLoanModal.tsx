import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
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
import { useUpdateLoanMutation } from "../../features/api/apiSlice";
import { buildLoanSchedule, calculateLoanEmi, isFlexibleLoan } from "../../lib/loans";
import { formatINR } from "../../lib/format";
import type { Loan, LoanRateType, LoanRepaymentMode, LoanStatus } from "../../types/finance";

type EditLoanModalProps = {
  opened: boolean;
  onClose: () => void;
  loan: Loan | null;
  readOnly?: boolean;
};

const buildFormFromLoan = (loan: Loan) => ({
  name: loan.name,
  lender_name: loan.lender_name ?? "",
  loan_type: loan.loan_type ?? "",
  repayment_mode: loan.repayment_mode,
  principal_original: String(loan.principal_original),
  principal_outstanding: String(loan.principal_outstanding),
  rate_type: loan.rate_type,
  rate_current: String(loan.rate_current),
  tenure_months: String(loan.tenure_months),
  emi_amount: String(loan.emi_amount),
  repayment_day: String(loan.repayment_day),
  start_date: loan.start_date,
  first_due_date: loan.first_due_date,
  status: loan.status,
  notes: loan.notes ?? "",
});

const buildEmptyForm = () => ({
  name: "",
  lender_name: "",
  loan_type: "",
  repayment_mode: "scheduled" as LoanRepaymentMode,
  principal_original: "",
  principal_outstanding: "",
  rate_type: "fixed" as LoanRateType,
  rate_current: "",
  tenure_months: "12",
  emi_amount: "",
  repayment_day: "1",
  start_date: dayjs().format("YYYY-MM-DD"),
  first_due_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
  status: "active" as LoanStatus,
  notes: "",
});

export const EditLoanModal = ({
  opened,
  onClose,
  loan,
  readOnly = false,
}: EditLoanModalProps) => {
  const [form, setForm] = useState(() => (loan ? buildFormFromLoan(loan) : buildEmptyForm()));
  const [regenerateSchedule, setRegenerateSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateLoan, { isLoading }] = useUpdateLoanMutation();

  const isFlexible = isFlexibleLoan(form.repayment_mode);
  const principal = Number(form.principal_outstanding);
  const annualRate = Number(form.rate_current);
  const tenureMonths = Number(form.tenure_months);
  const suggestedEmi =
    principal > 0 && annualRate >= 0 && tenureMonths > 0
      ? calculateLoanEmi(principal, annualRate, tenureMonths)
      : 0;
  const effectiveEmi = Number(form.emi_amount) > 0 ? Number(form.emi_amount) : suggestedEmi;
  const previewSchedule = useMemo(
    () =>
      isFlexible
        ? []
        : buildLoanSchedule({
            principal: principal > 0 ? principal : 0,
            annualRate: annualRate >= 0 ? annualRate : 0,
            tenureMonths: tenureMonths > 0 ? tenureMonths : 0,
            firstDueDate: form.first_due_date,
            emiAmount: effectiveEmi > 0 ? effectiveEmi : 0,
          }),
    [annualRate, effectiveEmi, form.first_due_date, isFlexible, principal, tenureMonths]
  );
  const totalInterest = previewSchedule.reduce((sum, item) => sum + item.interest_due, 0);
  const payoffDate =
    previewSchedule.length > 0
      ? previewSchedule[previewSchedule.length - 1]?.due_date ?? null
      : null;

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

    const principalOriginal = Number(form.principal_original);
    const principalOutstanding = Number(form.principal_outstanding);
    const rateValue = Number(form.rate_current);
    const tenureValue = Number(form.tenure_months);
    const emiValue =
      Number(form.emi_amount) > 0 ? Number(form.emi_amount) : suggestedEmi;
    const repaymentDay = Number(form.repayment_day);
    const derivedRepaymentDay = dayjs(form.start_date || undefined).date();
    const normalizedRepaymentDay =
      derivedRepaymentDay >= 1 && derivedRepaymentDay <= 31 ? derivedRepaymentDay : 1;
    const normalizedFirstDueDate = form.first_due_date || form.start_date;

    if (!form.name.trim()) {
      setError("Enter a loan name.");
      return;
    }
    if (!principalOriginal || Number.isNaN(principalOriginal) || principalOriginal <= 0) {
      setError("Enter a valid original principal.");
      return;
    }
    if (
      Number.isNaN(principalOutstanding) ||
      principalOutstanding < 0 ||
      principalOutstanding > principalOriginal
    ) {
      setError("Outstanding principal should be between 0 and original principal.");
      return;
    }
    if (Number.isNaN(rateValue) || rateValue < 0) {
      setError("Enter a valid interest rate.");
      return;
    }
    if (isFlexible && rateValue !== 0) {
      setError("Flexible loans currently support only 0% interest.");
      return;
    }
    if (!isFlexible && (!tenureValue || Number.isNaN(tenureValue) || tenureValue <= 0)) {
      setError("Enter a valid tenure in months.");
      return;
    }
    if (!isFlexible && (!emiValue || Number.isNaN(emiValue) || emiValue <= 0)) {
      setError("Enter a valid EMI amount.");
      return;
    }
    if (
      !isFlexible &&
      (!repaymentDay || Number.isNaN(repaymentDay) || repaymentDay < 1 || repaymentDay > 31)
    ) {
      setError("Repayment day must be between 1 and 31.");
      return;
    }
    if (!form.start_date || (!isFlexible && !form.first_due_date)) {
      setError("Select start date and first due date.");
      return;
    }
    if (regenerateSchedule && form.status === "closed") {
      setError("Reopen the loan before regenerating the schedule.");
      return;
    }
    if (regenerateSchedule && isFlexible) {
      setError("Flexible loans do not have a schedule to regenerate.");
      return;
    }

    try {
      await updateLoan({
        id: loan.id,
        name: form.name.trim(),
        lender_name: form.lender_name.trim() ? form.lender_name.trim() : null,
        loan_type: form.loan_type.trim() ? form.loan_type.trim() : null,
        repayment_mode: form.repayment_mode,
        principal_original: principalOriginal,
        principal_outstanding: principalOutstanding,
        rate_type: form.rate_type,
        rate_current: rateValue,
        tenure_months: isFlexible ? 1 : tenureValue,
        emi_amount: isFlexible ? Math.max(principalOutstanding, 1) : emiValue,
        repayment_day: isFlexible ? normalizedRepaymentDay : repaymentDay,
        start_date: form.start_date,
        first_due_date: isFlexible ? normalizedFirstDueDate : form.first_due_date,
        status: form.status,
        notes: form.notes.trim() ? form.notes.trim() : null,
        regenerate_schedule: isFlexible ? false : regenerateSchedule,
      }).unwrap();
      onClose();
    } catch {
      setError("Unable to update loan.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Edit loan" size="lg">
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Loan name"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            required
          />
          <TextInput
            label="Lender"
            value={form.lender_name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, lender_name: event.target.value }))
            }
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Loan type"
            value={form.loan_type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, loan_type: event.target.value }))
            }
            placeholder="Home / Personal / Auto"
          />
          <Select
            label="Repayment style"
            value={form.repayment_mode}
            data={[
              { value: "scheduled", label: "Scheduled EMI" },
              { value: "flexible", label: "Flexible lump-sum" },
            ]}
            disabled
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label="Original principal"
            type="number"
            value={form.principal_original}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, principal_original: event.target.value }))
            }
            min="0"
            step="0.01"
            required
          />
          <TextInput
            label="Outstanding principal"
            type="number"
            value={form.principal_outstanding}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, principal_outstanding: event.target.value }))
            }
            min="0"
            step="0.01"
            required
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                status: (value as LoanStatus | null) ?? prev.status,
              }))
            }
            data={[
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "closed", label: "Closed" },
            ]}
            required
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Rate type"
            value={form.rate_type}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                rate_type: (value as LoanRateType | null) ?? prev.rate_type,
              }))
            }
            data={[
              { value: "fixed", label: "Fixed" },
              { value: "floating", label: "Floating" },
            ]}
          />
          <TextInput
            label="Interest rate (%)"
            type="number"
            value={form.rate_current}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, rate_current: event.target.value }))
            }
            min="0"
            step="0.0001"
            required
          />
        </SimpleGrid>

        {isFlexible ? (
          <Alert color="blue" variant="light">
            Flexible loans do not create EMI reminders. Record repayments manually against the
            outstanding amount.
          </Alert>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label="Tenure (months)"
                type="number"
                value={form.tenure_months}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, tenure_months: event.target.value }))
                }
                min="1"
                step="1"
                required
              />
              <TextInput
                label="EMI amount"
                type="number"
                value={form.emi_amount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, emi_amount: event.target.value }))
                }
                min="0"
                step="0.01"
                rightSection={
                  suggestedEmi > 0 ? (
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, emi_amount: String(suggestedEmi) }))
                      }
                    >
                      Use
                    </Button>
                  ) : null
                }
                rightSectionWidth={suggestedEmi > 0 ? 56 : undefined}
                required
              />
              <TextInput
                label="Repayment day"
                type="number"
                value={form.repayment_day}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, repayment_day: event.target.value }))
                }
                min="1"
                max="31"
                step="1"
                required
              />
            </SimpleGrid>
          </>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <DateInput
            label="Loan start date"
            value={form.start_date ? dayjs(form.start_date).toDate() : null}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                start_date: value ? dayjs(value).format("YYYY-MM-DD") : "",
              }))
            }
            required
          />
          {isFlexible ? null : (
            <DateInput
              label="First due date"
              value={form.first_due_date ? dayjs(form.first_due_date).toDate() : null}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  first_due_date: value ? dayjs(value).format("YYYY-MM-DD") : "",
                }))
              }
              required
            />
          )}
        </SimpleGrid>

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, notes: event.target.value }))
          }
          minRows={2}
        />

        {isFlexible ? null : (
          <Switch
            label="Regenerate upcoming schedule from current outstanding"
            description="Paid installments remain. Due installments are rebuilt using updated EMI/rate/tenure."
            checked={regenerateSchedule}
            onChange={(event) => setRegenerateSchedule(event.currentTarget.checked)}
            disabled={form.status === "closed"}
          />
        )}

        {previewSchedule.length > 0 ? (
          <Alert color="blue" variant="light">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                Updated projection
              </Text>
              <Text size="xs">
                Suggested EMI: {formatINR(suggestedEmi)} · Using EMI: {formatINR(effectiveEmi)}
              </Text>
              <Text size="xs">
                Projected interest: {formatINR(totalInterest)} · Payoff:{" "}
                {payoffDate ? dayjs(payoffDate).format("MMM YYYY") : "-"}
              </Text>
            </Stack>
          </Alert>
        ) : null}

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
            Save changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
