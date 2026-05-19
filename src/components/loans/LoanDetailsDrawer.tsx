import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import { PencilLine, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../DatatrixTable";
import { useReverseLoanPaymentMutation } from "../../features/api/apiSlice";
import { EditLoanPaymentModal } from "./EditLoanPaymentModal";
import { formatINR } from "../../lib/format";
import {
  estimateLoanProjection,
  getLoanScheduleRemaining,
  getLoanSummary,
} from "../../lib/loans";
import type {
  Loan,
  LoanPayment,
  LoanRateRevision,
  LoanScheduleItem,
} from "../../types/finance";

type LoanDetailsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  loan: Loan | null;
  schedule: LoanScheduleItem[];
  payments: LoanPayment[];
  rateRevisions: LoanRateRevision[];
  loadingRevisions?: boolean;
  readOnly?: boolean;
};

type ScheduleRow = {
  id: string;
  installment_no: number;
  due_date: string;
  opening_principal: number;
  principal_due: number;
  interest_due: number;
  emi_due: number;
  fees_due: number;
  status: string;
  paid_date: string;
};

type PaymentRow = {
  id: string;
  schedule_id: string | null;
  payment_date: string;
  amount_paid: number;
  allocation_principal: number;
  allocation_interest: number;
  allocation_fees: number;
  method: string;
  note: string;
};

type RateRevisionRow = {
  id: string;
  effective_date: string;
  previous_rate: number;
  new_rate: number;
  delta: number;
  note: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const statusColorMap: Record<string, string> = {
  active: "blue",
  closed: "green",
  paused: "yellow",
  paid: "green",
  due: "blue",
  partial: "orange",
  overdue: "red",
  skipped: "gray",
};

export const LoanDetailsDrawer = ({
  opened,
  onClose,
  loan,
  schedule,
  payments,
  rateRevisions,
  loadingRevisions = false,
  readOnly = false,
}: LoanDetailsDrawerProps) => {
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reversingPaymentId, setReversingPaymentId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [reverseLoanPayment] = useReverseLoanPaymentMutation();
  const summary = useMemo(
    () =>
      loan
        ? getLoanSummary(loan.principal_outstanding, loan.principal_original)
        : null,
    [loan]
  );

  const loanScheduleItems = useMemo(() => {
    if (!loan) {
      return [];
    }
    return schedule
      .filter((item) => item.loan_id === loan.id)
      .sort((a, b) => a.installment_no - b.installment_no);
  }, [loan, schedule]);

  const scheduleRows = useMemo<ScheduleRow[]>(() => {
    return loanScheduleItems.map((item) => ({
        id: item.id,
        installment_no: item.installment_no,
        due_date: dayjs(item.due_date).format("DD MMM YYYY"),
        opening_principal: item.opening_principal,
        principal_due: item.principal_due,
        interest_due: item.interest_due,
        emi_due: item.emi_due + item.fees_due,
        fees_due: item.fees_due,
        status: item.status,
        paid_date: item.paid_date ? dayjs(item.paid_date).format("DD MMM YYYY") : "-",
      }));
  }, [loanScheduleItems]);

  const loanPayments = useMemo(() => {
    if (!loan) {
      return [];
    }
    return payments
      .filter((item) => item.loan_id === loan.id)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [loan, payments]);

  const paymentRows = useMemo<PaymentRow[]>(() => {
    return loanPayments.map((item) => ({
        id: item.id,
        schedule_id: item.schedule_id,
        payment_date: dayjs(item.payment_date).format("DD MMM YYYY"),
        amount_paid: item.amount_paid,
        allocation_principal: item.allocation_principal,
        allocation_interest: item.allocation_interest,
        allocation_fees: item.allocation_fees,
        method: item.method,
        note: item.note ?? "-",
      }));
  }, [loanPayments]);
  const selectedPayment = useMemo(
    () => payments.find((item) => item.id === editingPaymentId) ?? null,
    [editingPaymentId, payments]
  );
  const editModalKey = `loan-payment-edit-${selectedPayment?.id ?? "new"}-${
    editingPaymentId ? "open" : "closed"
  }`;
  const rateRevisionRows = useMemo<RateRevisionRow[]>(() => {
    if (!loan) {
      return [];
    }
    return rateRevisions
      .filter((item) => item.loan_id === loan.id)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
      .map((item) => ({
        id: item.id,
        effective_date: dayjs(item.effective_date).format("DD MMM YYYY"),
        previous_rate: item.previous_rate,
        new_rate: item.new_rate,
        delta: Number((item.new_rate - item.previous_rate).toFixed(4)),
        note: item.note ?? "-",
      }));
  }, [loan, rateRevisions]);

  const principalPaid = useMemo(
    () => loanPayments.reduce((sum, row) => sum + row.allocation_principal, 0),
    [loanPayments]
  );
  const interestPaid = useMemo(
    () => loanPayments.reduce((sum, row) => sum + row.allocation_interest, 0),
    [loanPayments]
  );
  const feesPaid = useMemo(
    () => loanPayments.reduce((sum, row) => sum + row.allocation_fees, 0),
    [loanPayments]
  );
  const openInstallments = useMemo(
    () =>
      loanScheduleItems.filter((row) => row.status !== "paid" && row.status !== "skipped")
        .length,
    [loanScheduleItems]
  );
  const overdueInstallments = useMemo(
    () => loanScheduleItems.filter((row) => row.status === "overdue").length,
    [loanScheduleItems]
  );
  const nextDueLabel = useMemo(() => {
    if (loan?.repayment_mode === "flexible") {
      return "On demand";
    }
    const nextDue = loanScheduleItems.find(
      (row) => row.status !== "paid" && row.status !== "skipped"
    );
    return nextDue ? dayjs(nextDue.due_date).format("DD MMM YYYY") : "-";
  }, [loan?.repayment_mode, loanScheduleItems]);

  const remainingInterest = useMemo(
    () =>
      loanScheduleItems.reduce((sum, row) => {
        const remaining = getLoanScheduleRemaining({
          principalDue: row.principal_due,
          interestDue: row.interest_due,
          feesDue: row.fees_due,
          principalPaid: row.principal_paid,
          interestPaid: row.interest_paid,
          feesPaid: row.fees_paid,
          amountPaid: row.amount_paid,
        });
        return sum + remaining.remainingInterestDue;
      }, 0),
    [loanScheduleItems]
  );
  const totalInterestEstimate = useMemo(
    () => interestPaid + remainingInterest,
    [interestPaid, remainingInterest]
  );
  const interestProgressPercent = useMemo(() => {
    if (totalInterestEstimate <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((interestPaid / totalInterestEstimate) * 100));
  }, [interestPaid, totalInterestEstimate]);

  const prepaymentPrincipal = useMemo(
    () =>
      loanPayments.reduce((sum, payment) => {
        const schedulePrincipal = Number(payment.schedule_allocation_principal ?? 0);
        const extraPrincipal = Math.max(
          0,
          Number(payment.allocation_principal ?? 0) - schedulePrincipal
        );
        return sum + extraPrincipal;
      }, 0),
    [loanPayments]
  );
  const prepaymentImpact = useMemo(() => {
    if (!loan || prepaymentPrincipal <= 0 || loan.emi_amount <= 0 || loan.rate_current < 0) {
      return null;
    }

    const principalWithoutPrepay = Math.min(
      loan.principal_original > 0 ? loan.principal_original : Number.MAX_SAFE_INTEGER,
      loan.principal_outstanding + prepaymentPrincipal
    );
    const withPrepayProjection = estimateLoanProjection({
      principal: loan.principal_outstanding,
      annualRate: loan.rate_current,
      emiAmount: loan.emi_amount,
    });
    const withoutPrepayProjection = estimateLoanProjection({
      principal: principalWithoutPrepay,
      annualRate: loan.rate_current,
      emiAmount: loan.emi_amount,
    });
    if (!withPrepayProjection || !withoutPrepayProjection) {
      return null;
    }

    return {
      monthsSaved: Math.max(0, withoutPrepayProjection.months - withPrepayProjection.months),
      interestSaved: Math.max(
        0,
        round2(withoutPrepayProjection.totalInterest - withPrepayProjection.totalInterest)
      ),
    };
  }, [loan, prepaymentPrincipal]);
  const prepaymentSpeed = useMemo(() => {
    if (!prepaymentImpact || prepaymentImpact.monthsSaved <= 0) {
      return {
        label: "No prepayment speed-up detected yet",
        color: "dimmed",
      };
    }
    const suffix = prepaymentImpact.monthsSaved === 1 ? "" : "s";
    return {
      label: `Estimated payoff faster by ${prepaymentImpact.monthsSaved} month${suffix}`,
      color: "teal.7",
    };
  }, [prepaymentImpact]);

  const scheduleColumns = useMemo<ColDef<ScheduleRow>[]>(
    () => [
      { headerName: "#", field: "installment_no", maxWidth: 80 },
      { headerName: "Due", field: "due_date", maxWidth: 140 },
      {
        headerName: "Opening",
        field: "opening_principal",
        maxWidth: 140,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Principal",
        field: "principal_due",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Interest",
        field: "interest_due",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "EMI+Fees",
        field: "emi_due",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 120,
        cellRenderer: (params: { value?: string }) =>
          params.value ? (
            <Badge
              variant="light"
              color={statusColorMap[params.value] ?? "gray"}
              radius="sm"
            >
              {params.value.charAt(0).toUpperCase() + params.value.slice(1)}
            </Badge>
          ) : null,
      },
      { headerName: "Paid", field: "paid_date", maxWidth: 140 },
    ],
    []
  );

  const paymentColumns = useMemo<ColDef<PaymentRow>[]>(
    () => [
      { headerName: "Date", field: "payment_date", maxWidth: 130 },
      {
        headerName: "Paid",
        field: "amount_paid",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Principal",
        field: "allocation_principal",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Interest",
        field: "allocation_interest",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Fees",
        field: "allocation_fees",
        maxWidth: 120,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      { headerName: "Method", field: "method", maxWidth: 130 },
      { headerName: "Note", field: "note", flex: 1.2 },
      {
        headerName: "Action",
        field: "id",
        minWidth: 210,
        sortable: false,
        cellRenderer: (params: { data?: PaymentRow }) => {
          const row = params.data;
          if (!row) {
            return null;
          }
          return (
            <Group gap={6} wrap="nowrap">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<PencilLine size={14} />}
                disabled={readOnly || reversingPaymentId !== null || !row.schedule_id}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingPaymentId(row.id);
                }}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<RotateCcw size={14} />}
                loading={reversingPaymentId === row.id}
                disabled={readOnly || reversingPaymentId !== null}
                onClick={async (event) => {
                  event.stopPropagation();
                  if (
                    typeof globalThis.confirm === "function" &&
                    !globalThis.confirm(
                      "Reverse this payment? This will undo outstanding/schedule updates and delete the linked transaction."
                    )
                  ) {
                    return;
                  }
                  setReverseError(null);
                  setReversingPaymentId(row.id);
                  try {
                    await reverseLoanPayment({ id: row.id }).unwrap();
                  } catch {
                    setReverseError("Unable to reverse payment.");
                  } finally {
                    setReversingPaymentId(null);
                  }
                }}
              >
                Reverse
              </Button>
            </Group>
          );
        },
      },
    ],
    [readOnly, reverseLoanPayment, reversingPaymentId]
  );
  const rateRevisionColumns = useMemo<ColDef<RateRevisionRow>[]>(
    () => [
      { headerName: "Effective", field: "effective_date", maxWidth: 140 },
      {
        headerName: "Previous",
        field: "previous_rate",
        maxWidth: 120,
        valueFormatter: (params) => `${Number(params.value ?? 0).toFixed(2)}%`,
      },
      {
        headerName: "New",
        field: "new_rate",
        maxWidth: 120,
        valueFormatter: (params) => `${Number(params.value ?? 0).toFixed(2)}%`,
      },
      {
        headerName: "Delta",
        field: "delta",
        maxWidth: 110,
        valueFormatter: (params) => {
          const value = Number(params.value ?? 0);
          const sign = value > 0 ? "+" : "";
          return `${sign}${value.toFixed(2)}%`;
        },
      },
      { headerName: "Note", field: "note", flex: 1.2 },
    ],
    []
  );

  return (
    <>
      <EditLoanPaymentModal
        key={editModalKey}
        opened={Boolean(editingPaymentId)}
        onClose={() => setEditingPaymentId(null)}
        payment={selectedPayment}
        readOnly={readOnly}
      />
      <Drawer
        opened={opened}
        onClose={onClose}
        title={loan ? `${loan.name} details` : "Loan details"}
        position="right"
        size="xl"
      >
      {loan && summary ? (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Outstanding
              </Text>
              <Text fw={700} size="lg">
                {formatINR(summary.outstanding)}
              </Text>
              <Text size="xs" c="dimmed">
                Next due: {nextDueLabel}
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Repaid
              </Text>
              <Text fw={700} size="lg">
                {formatINR(summary.repaid)}
              </Text>
              <Text size="xs" c="dimmed">
                {summary.progress}% of principal
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Installments
              </Text>
              <Group justify="space-between" mt={4}>
                <Text size="sm">Open</Text>
                <Text size="sm" fw={600}>
                  {openInstallments}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Overdue</Text>
                <Text size="sm" fw={600} c={overdueInstallments > 0 ? "orange.7" : undefined}>
                  {overdueInstallments}
                </Text>
              </Group>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Principal paid
              </Text>
              <Text fw={600}>{formatINR(principalPaid)}</Text>
            </Paper>
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Interest paid
              </Text>
              <Text fw={600}>{formatINR(interestPaid)}</Text>
            </Paper>
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Fees paid
              </Text>
              <Text fw={600}>{formatINR(feesPaid)}</Text>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Interest outlook
              </Text>
              <Text fw={700}>{formatINR(interestPaid)} paid</Text>
              <Text size="sm" c="dimmed">
                {formatINR(remainingInterest)} remaining
              </Text>
              <Progress
                value={interestProgressPercent}
                size="sm"
                radius="xl"
                mt={8}
                color={interestProgressPercent >= 80 ? "teal" : "blue"}
              />
              <Text size="xs" c="dimmed" mt={6}>
                {interestProgressPercent}% of estimated total interest (
                {formatINR(totalInterestEstimate)})
              </Text>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Prepayment savings
              </Text>
              <Text fw={700}>{formatINR(prepaymentPrincipal)} extra principal</Text>
              <Text size="sm" c="dimmed">
                Estimated interest saved {formatINR(prepaymentImpact?.interestSaved ?? 0)}
              </Text>
              <Text size="sm" fw={600} c={prepaymentSpeed.color} mt={6}>
                {prepaymentSpeed.label}
              </Text>
            </Paper>
          </SimpleGrid>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={600}>Rate revision timeline</Text>
              <Badge variant="light" color="blue">
                {rateRevisionRows.length} revisions
              </Badge>
            </Group>
            <DatatrixTable
              rows={rateRevisionRows}
              columns={rateRevisionColumns}
              height={220}
              loading={loadingRevisions}
              emptyLabel="No rate revisions yet."
              getRowId={(row) => row.id}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={600}>Amortization schedule</Text>
              <Badge variant="light" color="blue">
                {scheduleRows.length} rows
              </Badge>
            </Group>
            <DatatrixTable
              rows={scheduleRows}
              columns={scheduleColumns}
              height={320}
              emptyLabel="No schedule rows."
              getRowId={(row) => row.id}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={600}>Payment history</Text>
              <Badge variant="light" color="blue">
                {paymentRows.length} payments
              </Badge>
            </Group>
            {reverseError ? (
              <Alert color="red" variant="light">
                {reverseError}
              </Alert>
            ) : null}
            <DatatrixTable
              rows={paymentRows}
              columns={paymentColumns}
              height={280}
              emptyLabel="No payments posted yet."
              getRowId={(row) => row.id}
            />
          </Stack>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select a loan to view details.
        </Text>
      )}
      </Drawer>
    </>
  );
};
