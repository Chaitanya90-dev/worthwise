import { Alert, Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { BadgePercent, Eye, PencilLine, Plus } from "lucide-react";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DatatrixTable } from "../components/DatatrixTable";
import { EmptyState } from "../components/common/EmptyState";
import { PageStatusChips } from "../components/common/PageStatusChips";
import { CreateLoanModal } from "../components/loans/CreateLoanModal";
import { EditLoanModal } from "../components/loans/EditLoanModal";
import { LoanDetailsDrawer } from "../components/loans/LoanDetailsDrawer";
import { PostLoanPaymentModal } from "../components/loans/PostLoanPaymentModal";
import { RateRevisionModal } from "../components/loans/RateRevisionModal";
import { useReadOnly } from "../context/ReadOnlyContext";
import { useAppMonth } from "../context/AppMonthContext";
import {
  useGetLoanRateRevisionsQuery,
  useSetLoanStatusMutation,
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetLoanPaymentsQuery,
  useGetLoanScheduleQuery,
  useGetLoansQuery,
  useGetPaymentMethodsQuery,
} from "../features/api/apiSlice";
import { formatINR } from "../lib/format";
import {
  classifyLoanScheduleStatus,
  getLoanScheduleRemaining,
  getLoanSummary,
} from "../lib/loans";
import type { LoanScheduleStatus } from "../types/finance";

type LoanRow = {
  id: string;
  name: string;
  lender: string;
  type: string;
  rate: string;
  emi: number;
  repayment_mode: string;
  outstanding: number;
  progress: number;
  next_due: string;
  status: string;
};

type DueRow = {
  id: string;
  loan_name: string;
  due_date: string;
  due_date_raw: string;
  amount_due: number;
  principal_due: number;
  interest_due: number;
  fees_due: number;
  status: LoanScheduleStatus;
};

type PaymentRow = {
  id: string;
  loan_name: string;
  payment_date: string;
  amount_paid: number;
  principal: number;
  interest: number;
  fees: number;
  method: string;
  note: string;
};

type DueReminderRow = DueRow & {
  daysToDue: number;
  urgencyLabel: string;
  severity: "critical" | "high" | "normal";
  severityColor: string;
};

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

const StatusCell = <T extends { status: string }>({
  data,
}: ICellRendererParams<T>) => {
  if (!data) {
    return null;
  }
  const label = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  return (
    <Badge variant="light" color={statusColorMap[data.status] ?? "gray"} radius="sm">
      {label}
    </Badge>
  );
};

export const Loans = () => {
  const isReadOnly = useReadOnly();
  const { month } = useAppMonth();
  const { data: loans = [], isLoading: isLoansLoading } = useGetLoansQuery();
  const { data: rateRevisions = [], isLoading: isRateRevisionsLoading } =
    useGetLoanRateRevisionsQuery();
  const { data: schedule = [], isLoading: isScheduleLoading } = useGetLoanScheduleQuery();
  const { data: payments = [], isLoading: isPaymentsLoading } = useGetLoanPaymentsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [rateRevisionLoanId, setRateRevisionLoanId] = useState<string | null>(null);
  const [detailsLoanId, setDetailsLoanId] = useState<string | null>(null);
  const [selectedDueId, setSelectedDueId] = useState<string | null>(null);
  const [selectedPaymentLoanId, setSelectedPaymentLoanId] = useState<string | null>(null);
  const [isPostPaymentOpen, setIsPostPaymentOpen] = useState(false);
  const [showClosedLoans, setShowClosedLoans] = useState(false);
  const [statusUpdatingLoanId, setStatusUpdatingLoanId] = useState<string | null>(null);
  const [loanActionError, setLoanActionError] = useState<string | null>(null);
  const [setLoanStatus] = useSetLoanStatusMutation();
  const monthStart = dayjs(`${month}-01`).startOf("month");
  const monthEnd = dayjs(`${month}-01`).endOf("month");

  const scheduleRows = useMemo(
    () =>
      schedule.map((item) => ({
        ...item,
        status: classifyLoanScheduleStatus(item.due_date, item.status),
      })),
    [schedule]
  );

  const nextDueMap = useMemo(() => {
    const map = new Map<string, string>();
    const openRows = scheduleRows
      .filter((item) => item.status !== "paid" && item.status !== "skipped")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    openRows.forEach((item) => {
      if (!map.has(item.loan_id)) {
        map.set(item.loan_id, item.due_date);
      }
    });
    return map;
  }, [scheduleRows]);

  const loanRows = useMemo<LoanRow[]>(
    () =>
      loans
        .filter((loan) => showClosedLoans || loan.status !== "closed")
        .map((loan) => {
          const summary = getLoanSummary(
            loan.principal_outstanding,
            loan.principal_original
          );
          const nextDue = nextDueMap.get(loan.id);
          return {
            id: loan.id,
            name: loan.name,
            lender: loan.lender_name ?? "-",
            type: loan.loan_type ?? "-",
            rate:
              loan.repayment_mode === "flexible"
                ? "Flexible · 0.00%"
                : `${loan.rate_type} · ${loan.rate_current.toFixed(2)}%`,
            emi: loan.emi_amount,
            repayment_mode: loan.repayment_mode,
            outstanding: loan.principal_outstanding,
            progress: summary.progress,
            next_due:
              loan.repayment_mode === "flexible"
                ? "On demand"
                : nextDue
                  ? dayjs(nextDue).format("DD MMM YYYY")
                  : "-",
            status: loan.status,
          };
        }),
    [loans, nextDueMap, showClosedLoans]
  );

  const dueRows = useMemo<DueRow[]>(
    () =>
      scheduleRows
        .filter((item) => item.status !== "paid" && item.status !== "skipped")
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map((item) => {
          const remaining = getLoanScheduleRemaining({
            principalDue: item.principal_due,
            interestDue: item.interest_due,
            feesDue: item.fees_due,
            principalPaid: item.principal_paid,
            interestPaid: item.interest_paid,
            feesPaid: item.fees_paid,
            amountPaid: item.amount_paid,
          });
          return {
            id: item.id,
            loan_name: item.loan_name ?? "Loan",
            due_date: dayjs(item.due_date).format("DD MMM YYYY"),
            due_date_raw: item.due_date,
            amount_due: remaining.remainingTotalDue,
            principal_due: remaining.remainingPrincipalDue,
            interest_due: remaining.remainingInterestDue,
            fees_due: remaining.remainingFeesDue,
            status: item.status,
          };
        }),
    [scheduleRows]
  );

  const paymentRows = useMemo<PaymentRow[]>(
    () =>
      payments.slice(0, 20).map((item) => ({
        id: item.id,
        loan_name: item.loan_name ?? "Loan",
        payment_date: dayjs(item.payment_date).format("DD MMM YYYY"),
        amount_paid: item.amount_paid,
        principal: item.allocation_principal,
        interest: item.allocation_interest,
        fees: item.allocation_fees,
        method: item.method,
        note: item.note ?? "-",
      })),
    [payments]
  );

  const dueReminderRows = useMemo<DueReminderRow[]>(() => {
    const todayStart = dayjs().startOf("day");
    return [...dueRows]
      .sort((a, b) => a.due_date_raw.localeCompare(b.due_date_raw))
      .map((item) => {
        const dueDate = dayjs(item.due_date_raw);
        const daysToDue = dueDate.diff(todayStart, "day");
        if (daysToDue < 0) {
          return {
            ...item,
            daysToDue,
            urgencyLabel: `${Math.abs(daysToDue)} day${Math.abs(daysToDue) === 1 ? "" : "s"} late`,
            severity: "critical" as const,
            severityColor: "red",
          };
        }
        if (daysToDue === 0) {
          return {
            ...item,
            daysToDue,
            urgencyLabel: "Due today",
            severity: "high" as const,
            severityColor: "orange",
          };
        }
        if (daysToDue <= 3) {
          return {
            ...item,
            daysToDue,
            urgencyLabel: `Due in ${daysToDue} day${daysToDue === 1 ? "" : "s"}`,
            severity: "high" as const,
            severityColor: "orange",
          };
        }
        return {
          ...item,
          daysToDue,
          urgencyLabel: `Due in ${daysToDue} day${daysToDue === 1 ? "" : "s"}`,
          severity: "normal" as const,
          severityColor: "blue",
        };
      });
  }, [dueRows]);

  const selectedDue = useMemo(
    () => schedule.find((item) => item.id === selectedDueId) ?? null,
    [schedule, selectedDueId]
  );
  const selectedDueLoan = useMemo(
    () => loans.find((item) => item.id === selectedDue?.loan_id) ?? null,
    [loans, selectedDue?.loan_id]
  );
  const selectedPaymentLoan = useMemo(
    () => loans.find((item) => item.id === selectedPaymentLoanId) ?? null,
    [loans, selectedPaymentLoanId]
  );
  const selectedLoan = useMemo(
    () => loans.find((item) => item.id === editingLoanId) ?? null,
    [editingLoanId, loans]
  );
  const selectedRateRevisionLoan = useMemo(
    () => loans.find((item) => item.id === rateRevisionLoanId) ?? null,
    [loans, rateRevisionLoanId]
  );
  const detailsLoan = useMemo(
    () => loans.find((item) => item.id === detailsLoanId) ?? null,
    [detailsLoanId, loans]
  );

  const totalOutstanding = useMemo(
    () =>
      loans
        .filter((loan) => loan.status !== "closed")
        .reduce((sum, loan) => sum + loan.principal_outstanding, 0),
    [loans]
  );
  const dueThisMonth = useMemo(
    () =>
      dueRows
        .filter((item) => {
          const dueDate = dayjs(item.due_date_raw);
          return !dueDate.isBefore(monthStart, "day") && !dueDate.isAfter(monthEnd, "day");
        })
        .reduce((sum, item) => sum + item.amount_due, 0),
    [dueRows, monthEnd, monthStart]
  );
  const overdueCount = useMemo(
    () => dueReminderRows.filter((item) => item.severity === "critical").length,
    [dueReminderRows]
  );
  const overdueAmount = useMemo(
    () =>
      dueReminderRows
        .filter((item) => item.severity === "critical")
        .reduce((sum, item) => sum + item.amount_due, 0),
    [dueReminderRows]
  );
  const dueTodayAmount = useMemo(
    () =>
      dueReminderRows
        .filter((item) => item.daysToDue === 0)
        .reduce((sum, item) => sum + item.amount_due, 0),
    [dueReminderRows]
  );
  const dueNext7Amount = useMemo(
    () =>
      dueReminderRows
        .filter((item) => item.daysToDue > 0 && item.daysToDue <= 7)
        .reduce((sum, item) => sum + item.amount_due, 0),
    [dueReminderRows]
  );
  const dueRisk = useMemo(() => {
    if (dueReminderRows.some((item) => item.severity === "critical")) {
      return { label: "Critical", color: "red" };
    }
    if (dueReminderRows.some((item) => item.severity === "high")) {
      return { label: "Attention", color: "orange" };
    }
    return { label: "Stable", color: "blue" };
  }, [dueReminderRows]);
  const reminderRows = useMemo(
    () => dueReminderRows.filter((item) => item.daysToDue <= 7).slice(0, 5),
    [dueReminderRows]
  );
  const quickActionRow = useMemo(
    () =>
      dueReminderRows.find((item) => item.severity === "critical") ??
      dueReminderRows.find((item) => item.severity === "high") ??
      dueReminderRows[0] ??
      null,
    [dueReminderRows]
  );
  const activeLoans = useMemo(
    () => loans.filter((loan) => loan.status === "active").length,
    [loans]
  );
  const loanStatusChips = useMemo(
    () => [
      {
        id: "active",
        label: `${activeLoans} active`,
        color: activeLoans > 0 ? "blue" : "gray",
        tooltip: "Loans currently in active repayment.",
      },
      {
        id: "overdue",
        label: `${overdueCount} overdue`,
        color: overdueCount > 0 ? "red" : "gray",
        tooltip: "Installments past due and still unpaid.",
      },
      {
        id: "due-this-month",
        label: `Due ${formatINR(dueThisMonth)}`,
        color: dueThisMonth > 0 ? "orange" : "gray",
        tooltip: `Total remaining due in ${dayjs(`${month}-01`).format("MMM YYYY")}.`,
      },
    ],
    [activeLoans, dueThisMonth, month, overdueCount]
  );

  const handleSetStatus = useCallback(
    async (loanId: string, status: "active" | "closed") => {
      setLoanActionError(null);
      setStatusUpdatingLoanId(loanId);
      try {
        await setLoanStatus({ id: loanId, status }).unwrap();
      } catch {
        setLoanActionError("Unable to update loan status.");
      } finally {
        setStatusUpdatingLoanId(null);
      }
    },
    [setLoanStatus]
  );

  const loanColumns = useMemo<ColDef<LoanRow>[]>(
    () => [
      { headerName: "Loan", field: "name", flex: 1.2 },
      { headerName: "Lender", field: "lender", flex: 1.1 },
      { headerName: "Type", field: "type", maxWidth: 160 },
      { headerName: "Rate", field: "rate", maxWidth: 170 },
      {
        headerName: "EMI",
        field: "emi",
        maxWidth: 140,
        valueFormatter: (params) =>
          params.data?.repayment_mode === "flexible"
            ? "Flexible"
            : formatINR(Number(params.value ?? 0)),
        cellClass: "datatrix-cell-positive",
      },
      {
        headerName: "Outstanding",
        field: "outstanding",
        maxWidth: 170,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
        cellClass: "datatrix-cell-negative",
      },
      { headerName: "Next due", field: "next_due", maxWidth: 150 },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 130,
        cellRenderer: StatusCell<LoanRow>,
      },
      {
        headerName: "Action",
        field: "id",
        minWidth: 320,
        maxWidth: 360,
        sortable: false,
        cellRenderer: (params: ICellRendererParams<LoanRow>) => {
          const row = params.data;
          if (!row) {
            return null;
          }
          const isClosed = row.status === "closed";
          const isStatusLoading = statusUpdatingLoanId === row.id;
          const isFlexible = row.repayment_mode === "flexible";
          return (
            <Group gap={6} wrap="nowrap">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<Eye size={14} />}
                onClick={(event) => {
                  event.stopPropagation();
                  setDetailsLoanId(row.id);
                }}
              >
                Details
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<PencilLine size={14} />}
                disabled={isReadOnly}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingLoanId(row.id);
                }}
              >
                Edit
              </Button>
              {isFlexible ? (
                <Button
                  size="xs"
                  variant="light"
                  disabled={isReadOnly || isClosed}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedPaymentLoanId(row.id);
                    setSelectedDueId(null);
                    setIsPostPaymentOpen(true);
                  }}
                >
                  Record payment
                </Button>
              ) : null}
              <Button
                size="xs"
                variant="subtle"
                leftSection={<BadgePercent size={14} />}
                disabled={isReadOnly || isFlexible}
                onClick={(event) => {
                  event.stopPropagation();
                  setRateRevisionLoanId(row.id);
                }}
              >
                Revise rate
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color={isClosed ? "green" : "gray"}
                loading={isStatusLoading}
                disabled={isReadOnly || isStatusLoading}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleSetStatus(row.id, isClosed ? "active" : "closed");
                }}
              >
                {isClosed ? "Reopen" : "Close"}
              </Button>
            </Group>
          );
        },
      },
    ],
    [handleSetStatus, isReadOnly, statusUpdatingLoanId]
  );

  const dueColumns = useMemo<ColDef<DueRow>[]>(
    () => [
      { headerName: "Due", field: "due_date", maxWidth: 140 },
      { headerName: "Loan", field: "loan_name", flex: 1.2 },
      {
        headerName: "Amount due",
        field: "amount_due",
        maxWidth: 150,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Principal",
        field: "principal_due",
        maxWidth: 140,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Interest",
        field: "interest_due",
        maxWidth: 140,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 130,
        cellRenderer: StatusCell<DueRow>,
      },
      {
        headerName: "Action",
        field: "id",
        maxWidth: 160,
        sortable: false,
        cellRenderer: (params: ICellRendererParams<DueRow>) => {
          const row = params.data;
          if (!row) {
            return null;
          }
          return (
            <Button
              size="xs"
              variant="light"
              disabled={isReadOnly}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedDueId(row.id);
                setIsPostPaymentOpen(true);
              }}
            >
              Mark paid
            </Button>
          );
        },
      },
    ],
    [isReadOnly]
  );

  const paymentColumns = useMemo<ColDef<PaymentRow>[]>(
    () => [
      { headerName: "Date", field: "payment_date", maxWidth: 140 },
      { headerName: "Loan", field: "loan_name", flex: 1.2 },
      {
        headerName: "Paid",
        field: "amount_paid",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Principal",
        field: "principal",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Interest",
        field: "interest",
        maxWidth: 130,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      { headerName: "Method", field: "method", maxWidth: 130 },
      {
        headerName: "Note",
        field: "note",
        flex: 1.4,
        cellClass: "datatrix-cell-muted",
      },
    ],
    []
  );

  const createModalKey = `loan-create-${isCreateOpen ? "open" : "closed"}`;
  const editModalKey = `loan-edit-${selectedLoan?.id ?? "new"}-${editingLoanId ? "open" : "closed"}`;
  const rateRevisionModalKey = `loan-rate-revision-${selectedRateRevisionLoan?.id ?? "new"}-${
    rateRevisionLoanId ? "open" : "closed"
  }`;
  const postModalKey = `loan-post-${selectedDue?.id ?? selectedPaymentLoan?.id ?? "new"}-${
    isPostPaymentOpen ? "open" : "closed"
  }`;

  return (
    <Stack gap="lg">
      <CreateLoanModal
        key={createModalKey}
        opened={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        readOnly={isReadOnly}
      />
      <EditLoanModal
        key={editModalKey}
        opened={Boolean(editingLoanId)}
        onClose={() => setEditingLoanId(null)}
        loan={selectedLoan}
        readOnly={isReadOnly}
      />
      <RateRevisionModal
        key={rateRevisionModalKey}
        opened={Boolean(rateRevisionLoanId)}
        onClose={() => setRateRevisionLoanId(null)}
        loan={selectedRateRevisionLoan}
        scheduleRows={scheduleRows}
        readOnly={isReadOnly}
      />
      <PostLoanPaymentModal
        key={postModalKey}
        opened={isPostPaymentOpen}
        onClose={() => {
          setIsPostPaymentOpen(false);
          setSelectedDueId(null);
          setSelectedPaymentLoanId(null);
        }}
        schedule={selectedDue}
        loan={selectedPaymentLoan}
        accounts={accounts}
        paymentMethods={paymentMethods}
        categories={categories}
        currentOutstanding={
          selectedDueLoan?.principal_outstanding ?? selectedPaymentLoan?.principal_outstanding ?? null
        }
        currentLoanStatus={selectedDueLoan?.status ?? selectedPaymentLoan?.status ?? null}
        readOnly={isReadOnly}
      />
      <LoanDetailsDrawer
        opened={Boolean(detailsLoanId)}
        onClose={() => setDetailsLoanId(null)}
        loan={detailsLoan}
        schedule={scheduleRows}
        payments={payments}
        rateRevisions={rateRevisions}
        loadingRevisions={isRateRevisionsLoading}
        readOnly={isReadOnly}
      />

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Outstanding
          </Text>
          <Title order={3} mt="xs">
            {formatINR(totalOutstanding)}
          </Title>
          <Text size="sm" c="brand.6" fw={600}>
            Across {activeLoans} active loans
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Due this month
          </Text>
          <Title order={3} mt="xs">
            {formatINR(dueThisMonth)}
          </Title>
          <Text size="sm" c="brand.6" fw={600}>
            {dayjs(`${month}-01`).format("MMM YYYY")}
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Overdue EMIs
          </Text>
          <Title order={3} mt="xs">
            {overdueCount}
          </Title>
          <Text size="sm" c={overdueCount > 0 ? "orange.7" : "brand.6"} fw={600}>
            {overdueCount > 0 ? "Needs action" : "On track"}
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Posted payments
          </Text>
          <Title order={3} mt="xs">
            {payments.length}
          </Title>
          <Text size="sm" c="brand.6" fw={600}>
            Recorded in ledger
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="sm" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>EMI reminders</Title>
            <Text size="sm" c="dimmed">
              Upcoming dues and quick pay actions for this week.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge variant="light" color={dueRisk.color}>
              {dueRisk.label}
            </Badge>
            <Badge variant="light" color={overdueCount > 0 ? "red" : "blue"}>
              {dueReminderRows.length} open installments
            </Badge>
            {quickActionRow ? (
              <Button
                size="xs"
                variant="light"
                disabled={isReadOnly}
                onClick={() => {
                  setSelectedDueId(quickActionRow.id);
                  setIsPostPaymentOpen(true);
                }}
              >
                {quickActionRow.severity === "critical" ? "Resolve overdue" : "Post next due"}
              </Button>
            ) : null}
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="sm">
          <Paper withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Overdue
            </Text>
            <Text fw={700} c={overdueCount > 0 ? "red.7" : undefined}>
              {overdueCount}
            </Text>
            <Text size="xs" c="dimmed">
              {formatINR(overdueAmount)} pending
            </Text>
          </Paper>
          <Paper withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Due today
            </Text>
            <Text fw={700}>{formatINR(dueTodayAmount)}</Text>
            <Text size="xs" c="dimmed">
              Immediate action
            </Text>
          </Paper>
          <Paper withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Next 7 days
            </Text>
            <Text fw={700}>{formatINR(dueNext7Amount)}</Text>
            <Text size="xs" c="dimmed">
              Near-term obligations
            </Text>
          </Paper>
        </SimpleGrid>

        {reminderRows.length > 0 ? (
          <Stack gap={8}>
            {reminderRows.map((item) => (
              <Group
                key={item.id}
                justify="space-between"
                align="center"
                p={8}
                style={{ border: "1px solid var(--mantine-color-gray-2)", borderRadius: 10 }}
              >
                <Group gap="xs" align="center">
                  <Badge variant="light" color={item.severityColor}>
                    {item.urgencyLabel}
                  </Badge>
                  <Stack gap={0}>
                    <Text fw={600} size="sm">
                      {item.loan_name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Due {item.due_date}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs" align="center">
                  <Text fw={700}>{formatINR(item.amount_due)}</Text>
                  <Button
                    size="xs"
                    variant="light"
                    disabled={isReadOnly}
                    onClick={() => {
                      setSelectedDueId(item.id);
                      setIsPostPaymentOpen(true);
                    }}
                  >
                    Post
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No installments due in the next 7 days.
          </Text>
        )}
      </Paper>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap" mb="md">
          <Stack gap={2}>
            <Title order={4}>Loans</Title>
            <Text size="sm" c="dimmed">
              Track scheduled EMIs and flexible payback loans in one place.
            </Text>
            <PageStatusChips items={loanStatusChips} />
          </Stack>
          <Group gap="xs">
            <Button
              variant={showClosedLoans ? "filled" : "light"}
              color="gray"
              onClick={() => setShowClosedLoans((prev) => !prev)}
            >
              {showClosedLoans ? "Hide closed" : "Show closed"}
            </Button>
            <Button
              leftSection={<Plus size={16} strokeWidth={2} />}
              onClick={() => setIsCreateOpen(true)}
              disabled={isReadOnly}
            >
              New loan
            </Button>
          </Group>
        </Group>
        {loanActionError ? (
          <Alert color="red" variant="light" mb="sm">
            {loanActionError}
          </Alert>
        ) : null}
        {loanRows.length === 0 && !(isLoansLoading || isScheduleLoading) ? (
          <EmptyState
            title="No loans tracked yet"
            description="Add a scheduled EMI loan or a flexible friend/family loan to track what you still owe."
            action={
              isReadOnly
                ? undefined
                : {
                    label: "New loan",
                    onClick: () => setIsCreateOpen(true),
                  }
            }
          />
        ) : (
          <DatatrixTable
            rows={loanRows}
            columns={loanColumns}
            height={340}
            loading={isLoansLoading || isScheduleLoading}
            emptyLabel="No loans added yet."
            getRowId={(row) => row.id}
          />
        )}
      </Paper>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Group justify="space-between" align="center" mb="md">
            <Stack gap={2}>
              <Title order={4}>EMI queue</Title>
              <Text size="sm" c="dimmed">
                Post upcoming and overdue installments.
              </Text>
            </Stack>
            <Badge variant="light" color={overdueCount > 0 ? "orange" : "blue"}>
              {dueRows.length} open
            </Badge>
          </Group>
          <DatatrixTable
            rows={dueRows}
            columns={dueColumns}
            height={360}
            loading={isScheduleLoading}
            emptyLabel="No due installments."
            getRowId={(row) => row.id}
          />
        </Paper>

        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Group justify="space-between" align="center" mb="md">
            <Stack gap={2}>
              <Title order={4}>Recent payments</Title>
              <Text size="sm" c="dimmed">
                Last posted EMI/prepayment entries.
              </Text>
            </Stack>
            <Badge variant="light" color="blue">
              {paymentRows.length} shown
            </Badge>
          </Group>
          <DatatrixTable
            rows={paymentRows}
            columns={paymentColumns}
            height={360}
            loading={isPaymentsLoading}
            emptyLabel="No loan payments posted yet."
            getRowId={(row) => row.id}
          />
        </Paper>
      </SimpleGrid>
    </Stack>
  );
};
