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
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAddLoanMutation } from "../../features/api/apiSlice";
import { buildLoanSchedule, calculateLoanEmi, isFlexibleLoan } from "../../lib/loans";
import { formatINR } from "../../lib/format";
import type { LoanRateType, LoanRepaymentMode } from "../../types/finance";

type CreateLoanModalProps = {
  opened: boolean;
  onClose: () => void;
  readOnly?: boolean;
};

const defaultRepaymentDay = dayjs().date();
const defaultFirstDueDate = dayjs()
  .add(1, "month")
  .date(Math.min(defaultRepaymentDay, 28))
  .format("YYYY-MM-DD");

const buildInitialForm = () => ({
  name: "",
  lender_name: "",
  loan_type: "",
  repayment_mode: "scheduled" as LoanRepaymentMode,
  principal_original: "",
  rate_type: "fixed" as LoanRateType,
  rate_current: "",
  tenure_months: "12",
  emi_amount: "",
  repayment_day: String(defaultRepaymentDay),
  start_date: dayjs().format("YYYY-MM-DD"),
  first_due_date: defaultFirstDueDate,
  notes: "",
});

export const CreateLoanModal = ({
  opened,
  onClose,
  readOnly = false,
}: CreateLoanModalProps) => {
  const [form, setForm] = useState(() => buildInitialForm());
  const [error, setError] = useState<string | null>(null);
  const [addLoan, { isLoading }] = useAddLoanMutation();
  const isFlexible = isFlexibleLoan(form.repayment_mode);

  const principal = Number(form.principal_original);
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
        :
      buildLoanSchedule({
        principal: principal > 0 ? principal : 0,
        annualRate: annualRate >= 0 ? annualRate : 0,
        tenureMonths: tenureMonths > 0 ? tenureMonths : 0,
        firstDueDate: form.first_due_date,
        emiAmount: effectiveEmi > 0 ? effectiveEmi : 0,
      }),
    [annualRate, effectiveEmi, form.first_due_date, isFlexible, principal, tenureMonths]
  );
  const totalInterest = previewSchedule.reduce(
    (sum, item) => sum + item.interest_due,
    0
  );
  const payoffDate =
    previewSchedule.length > 0
      ? previewSchedule[previewSchedule.length - 1]?.due_date ?? null
      : null;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (readOnly) {
      setError("Demo mode is read-only. Changes are disabled.");
      return;
    }

    const principalValue = Number(form.principal_original);
    const rateValue = Number(form.rate_current);
    const tenureValue = Number(form.tenure_months);
    const emiValue =
      Number(form.emi_amount) > 0 ? Number(form.emi_amount) : suggestedEmi;
    const repaymentDay = Number(form.repayment_day);
    const defaultRepaymentDay = dayjs(form.start_date || undefined).date();
    const normalizedRepaymentDay =
      defaultRepaymentDay >= 1 && defaultRepaymentDay <= 31 ? defaultRepaymentDay : 1;
    const normalizedFirstDueDate = form.first_due_date || form.start_date;

    if (!form.name.trim()) {
      setError("Enter a loan name.");
      return;
    }
    if (!principalValue || Number.isNaN(principalValue) || principalValue <= 0) {
      setError("Enter a valid principal amount.");
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

    const firstMonthInterest = (principalValue * rateValue) / 1200;
    if (!isFlexible && emiValue <= firstMonthInterest) {
      setError("EMI should be higher than monthly interest to reduce principal.");
      return;
    }

    try {
      await addLoan({
        name: form.name.trim(),
        lender_name: form.lender_name.trim() ? form.lender_name.trim() : null,
        loan_type: form.loan_type.trim() ? form.loan_type.trim() : null,
        repayment_mode: form.repayment_mode,
        principal_original: principalValue,
        rate_type: form.rate_type,
        rate_current: rateValue,
        tenure_months: isFlexible ? 1 : tenureValue,
        emi_amount: isFlexible ? principalValue : emiValue,
        repayment_day: isFlexible ? normalizedRepaymentDay : repaymentDay,
        start_date: form.start_date,
        first_due_date: isFlexible ? normalizedFirstDueDate : form.first_due_date,
        status: "active",
        notes: form.notes.trim() ? form.notes.trim() : null,
      }).unwrap();
      onClose();
    } catch {
      setError("Unable to create loan.");
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add loan" size="lg">
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Loan name"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Home loan - SBI"
            required
          />
          <TextInput
            label="Lender"
            value={form.lender_name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, lender_name: event.target.value }))
            }
            placeholder="SBI"
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Loan type"
            value={form.loan_type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, loan_type: event.target.value }))
            }
            placeholder="Home / Personal / Car"
          />
          <Select
            label="Repayment style"
            value={form.repayment_mode}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                repayment_mode: (value as LoanRepaymentMode | null) ?? "scheduled",
                rate_current:
                  (value as LoanRepaymentMode | null) === "flexible" ? "0" : prev.rate_current,
              }))
            }
            data={[
              { value: "scheduled", label: "Scheduled EMI" },
              { value: "flexible", label: "Flexible lump-sum" },
            ]}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Rate type"
            value={form.rate_type}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                rate_type: (value as LoanRateType) ?? "fixed",
              }))
            }
            data={[
              { value: "fixed", label: "Fixed" },
              { value: "floating", label: "Floating" },
            ]}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label="Principal"
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
          {isFlexible ? null : (
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
          )}
        </SimpleGrid>
        {isFlexible ? (
          <Alert color="blue" variant="light">
            Flexible loans skip EMI scheduling. You will record repayments manually whenever you
            pay back a lump sum.
          </Alert>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
                        setForm((prev) => ({
                          ...prev,
                          emi_amount: String(suggestedEmi),
                        }))
                      }
                    >
                      Auto
                    </Button>
                  ) : undefined
                }
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
              label="First EMI due date"
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
          placeholder="Optional details"
          minRows={2}
        />
        {isFlexible ? null : (
          <Alert color="blue" variant="light">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                Loan preview
              </Text>
              <Text size="xs">
                Suggested EMI: {formatINR(suggestedEmi)} · Total interest:{" "}
                {formatINR(totalInterest)}
              </Text>
              <Text size="xs">
                Estimated payoff: {payoffDate ? dayjs(payoffDate).format("DD MMM YYYY") : "-"}
              </Text>
            </Stack>
          </Alert>
        )}
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" color="green" loading={isLoading} disabled={readOnly}>
            Save loan
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
