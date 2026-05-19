import {
  Alert,
  Badge,
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
import {
  usePostFlexibleLoanPaymentMutation,
  usePostLoanPaymentMutation,
} from "../../features/api/apiSlice";
import { formatINR } from "../../lib/format";
import {
  getLoanScheduleRemaining,
  isFlexibleLoan,
  simulateFlexibleLoanPayment,
  simulateLoanPayment,
} from "../../lib/loans";
import type {
  Account,
  Category,
  Loan,
  LoanScheduleItem,
  LoanStatus,
  PaymentMethod,
} from "../../types/finance";

type PostLoanPaymentModalProps = {
  opened: boolean;
  onClose: () => void;
  schedule: LoanScheduleItem | null;
  loan: Loan | null;
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
  currentOutstanding: number | null;
  currentLoanStatus: LoanStatus | null;
  readOnly?: boolean;
};

const buildInitialForm = (schedule: LoanScheduleItem | null, loan: Loan | null) => ({
  payment_date: dayjs().format("YYYY-MM-DD"),
  amount_paid: schedule
    ? String(
        getLoanScheduleRemaining({
          principalDue: schedule.principal_due,
          interestDue: schedule.interest_due,
          feesDue: schedule.fees_due,
          principalPaid: schedule.principal_paid,
          interestPaid: schedule.interest_paid,
          feesPaid: schedule.fees_paid,
          amountPaid: schedule.amount_paid,
        }).remainingTotalDue
      )
    : loan && isFlexibleLoan(loan.repayment_mode)
      ? ""
      : "",
  account_id: "",
  payment_method_id: "",
  category_id: "",
  merchant: "",
  note: "",
});

export const PostLoanPaymentModal = ({
  opened,
  onClose,
  schedule,
  loan,
  accounts,
  paymentMethods,
  categories,
  currentOutstanding,
  currentLoanStatus,
  readOnly = false,
}: PostLoanPaymentModalProps) => {
  const [form, setForm] = useState(() => buildInitialForm(schedule, loan));
  const [error, setError] = useState<string | null>(null);
  const [postLoanPayment, { isLoading: isPostingScheduled }] = usePostLoanPaymentMutation();
  const [postFlexibleLoanPayment, { isLoading: isPostingFlexible }] =
    usePostFlexibleLoanPaymentMutation();

  const isFlexible = loan ? isFlexibleLoan(loan.repayment_mode) : false;
  const isLoading = isPostingScheduled || isPostingFlexible;

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${formatINR(account.current_balance ?? 0)}`,
      })),
    [accounts]
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods]
  );
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === "expense")
        .map((category) => ({
          value: category.id,
          label: category.name,
        })),
    [categories]
  );
  const amountPaid = Number(form.amount_paid);
  const scheduleRemaining = useMemo(() => {
    if (!schedule) {
      return null;
    }
    return getLoanScheduleRemaining({
      principalDue: schedule.principal_due,
      interestDue: schedule.interest_due,
      feesDue: schedule.fees_due,
      principalPaid: schedule.principal_paid,
      interestPaid: schedule.interest_paid,
      feesPaid: schedule.fees_paid,
      amountPaid: schedule.amount_paid,
    });
  }, [schedule]);
  const paymentSimulation = useMemo(() => {
    if (
      !schedule ||
      !scheduleRemaining ||
      !amountPaid ||
      Number.isNaN(amountPaid) ||
      amountPaid <= 0 ||
      currentOutstanding === null ||
      !currentLoanStatus
    ) {
      return null;
    }

    return simulateLoanPayment({
      amountPaid,
      openingPrincipal: currentOutstanding,
      principalDue: scheduleRemaining.remainingPrincipalDue,
      interestDue: scheduleRemaining.remainingInterestDue,
      feesDue: scheduleRemaining.remainingFeesDue,
      dueTotal: scheduleRemaining.remainingTotalDue,
      currentOutstanding,
      currentLoanStatus,
    });
  }, [
    amountPaid,
    currentLoanStatus,
    currentOutstanding,
    schedule,
    scheduleRemaining,
  ]);
  const flexibleSimulation = useMemo(() => {
    if (
      !loan ||
      !isFlexible ||
      !amountPaid ||
      Number.isNaN(amountPaid) ||
      amountPaid <= 0 ||
      currentOutstanding === null ||
      !currentLoanStatus
    ) {
      return null;
    }

    return simulateFlexibleLoanPayment({
      amountPaid,
      currentOutstanding,
      currentLoanStatus,
    });
  }, [amountPaid, currentLoanStatus, currentOutstanding, isFlexible, loan]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (readOnly) {
      setError("Demo mode is read-only. Changes are disabled.");
      return;
    }
    const amount = Number(form.amount_paid);
    if (!form.account_id) {
      setError("Select an account for payment.");
      return;
    }
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    try {
      if (schedule) {
        await postLoanPayment({
          loan_id: schedule.loan_id,
          schedule_id: schedule.id,
          payment_date: form.payment_date,
          amount_paid: amount,
          account_id: form.account_id,
          payment_method_id: form.payment_method_id || null,
          category_id: form.category_id || null,
          merchant: form.merchant.trim() ? form.merchant.trim() : null,
          note: form.note.trim() ? form.note.trim() : null,
        }).unwrap();
      } else if (loan && isFlexible) {
        await postFlexibleLoanPayment({
          loan_id: loan.id,
          payment_date: form.payment_date,
          amount_paid: amount,
          account_id: form.account_id,
          payment_method_id: form.payment_method_id || null,
          category_id: form.category_id || null,
          merchant: form.merchant.trim() ? form.merchant.trim() : null,
          note: form.note.trim() ? form.note.trim() : null,
        }).unwrap();
      } else {
        setError("Missing loan payment context.");
        return;
      }
      onClose();
    } catch {
      setError("Unable to post loan payment.");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isFlexible ? "Record loan payment" : "Post EMI payment"}
      size="md"
    >
      <Stack component="form" gap="sm" onSubmit={handleSubmit}>
        {isFlexible ? (
          <Alert color="blue" variant="light">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                {loan?.name ?? "Flexible loan"}
              </Text>
              <Text size="xs">
                Outstanding {formatINR(currentOutstanding ?? 0)} · Repay whenever you have a lump
                sum
              </Text>
              <Text size="xs">This payment reduces principal directly.</Text>
            </Stack>
          </Alert>
        ) : (
          <Alert color="blue" variant="light">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                {schedule?.loan_name ?? "Loan installment"}
              </Text>
              <Text size="xs">
                Due {schedule ? dayjs(schedule.due_date).format("DD MMM YYYY") : "-"} · EMI{" "}
                {formatINR(schedule?.emi_due ?? 0)}
              </Text>
              <Text size="xs">
                Interest {formatINR(schedule?.interest_due ?? 0)} · Principal{" "}
                {formatINR(schedule?.principal_due ?? 0)}
              </Text>
              {scheduleRemaining ? (
                <Text size="xs">
                  Already paid {formatINR(scheduleRemaining.paidTotal)} · Remaining{" "}
                  {formatINR(scheduleRemaining.remainingTotalDue)}
                </Text>
              ) : null}
            </Stack>
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <DateInput
            label="Payment date"
            value={form.payment_date ? dayjs(form.payment_date).toDate() : null}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                payment_date: value ? dayjs(value).format("YYYY-MM-DD") : "",
              }))
            }
            required
          />
          <TextInput
            label="Amount paid"
            type="number"
            value={form.amount_paid}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amount_paid: event.target.value }))
            }
            min="0"
            step="0.01"
            required
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Account"
            data={accountOptions}
            value={form.account_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, account_id: value ?? "" }))
            }
            searchable
            required
          />
          <Select
            label="Payment method"
            data={paymentOptions}
            value={form.payment_method_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, payment_method_id: value ?? "" }))
            }
            searchable
            clearable
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Expense category"
            data={categoryOptions}
            value={form.category_id || null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, category_id: value ?? "" }))
            }
            searchable
            clearable
          />
          <TextInput
            label="Merchant / payee"
            value={form.merchant}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, merchant: event.target.value }))
            }
            placeholder="Optional"
          />
        </SimpleGrid>

        {paymentSimulation ? (
          <Alert color="teal" variant="light">
            <Stack gap={2}>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Payment simulation
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={paymentSimulation.method === "prepayment" ? "orange" : "blue"}
                >
                  {paymentSimulation.method === "prepayment" ? "Prepayment" : "EMI"}
                </Badge>
              </Group>
              <Text size="xs">
                Principal {formatINR(paymentSimulation.allocationPrincipal)} · Interest{" "}
                {formatINR(paymentSimulation.allocationInterest)} · Fees{" "}
                {formatINR(paymentSimulation.allocationFees)}
              </Text>
              <Text size="xs">
                Projected outstanding: {formatINR(paymentSimulation.nextOutstanding)} ·
                Installment status: {paymentSimulation.nextScheduleStatus}
              </Text>
            </Stack>
          </Alert>
        ) : null}

        {flexibleSimulation ? (
          <Alert color="teal" variant="light">
            <Stack gap={2}>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  Payment simulation
                </Text>
                <Badge size="sm" variant="light" color="orange">
                  Lump-sum
                </Badge>
              </Group>
              <Text size="xs">
                Principal {formatINR(flexibleSimulation.allocationPrincipal)} · Interest{" "}
                {formatINR(flexibleSimulation.allocationInterest)}
              </Text>
              <Text size="xs">
                Projected outstanding: {formatINR(flexibleSimulation.nextOutstanding)} · Loan
                status: {flexibleSimulation.nextLoanStatus}
              </Text>
            </Stack>
          </Alert>
        ) : null}

        <Textarea
          label="Note"
          value={form.note}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, note: event.target.value }))
          }
          placeholder="Optional payment reference"
          minRows={2}
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
            Post payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
