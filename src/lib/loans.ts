import dayjs from "dayjs";
import type {
  LoanPaymentMethod,
  LoanRepaymentMode,
  LoanScheduleItem,
  LoanScheduleStatus,
  LoanStatus,
} from "../types/finance";

export type LoanScheduleBuildItem = {
  installment_no: number;
  due_date: string;
  opening_principal: number;
  interest_due: number;
  principal_due: number;
  emi_due: number;
  fees_due: number;
  principal_paid: number;
  interest_paid: number;
  fees_paid: number;
  amount_paid: number;
  closing_principal_expected: number;
  status: LoanScheduleStatus;
  paid_date: string | null;
};

export type BuildLoanScheduleArgs = {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  firstDueDate: string;
  emiAmount: number;
  feesDue?: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export type LoanPaymentAllocationInput = {
  amountPaid: number;
  openingPrincipal: number;
  principalDue: number;
  interestDue: number;
  feesDue: number;
  dueTotal: number;
  currentOutstanding: number;
  currentLoanStatus: LoanStatus;
};

export type LoanPaymentAllocationResult = {
  amountPaid: number;
  allocationPrincipal: number;
  allocationInterest: number;
  allocationFees: number;
  method: LoanPaymentMethod;
  nextScheduleStatus: LoanScheduleStatus;
  nextOutstanding: number;
  nextLoanStatus: LoanStatus;
};

export type EstimateLoanPayoffMonthsInput = {
  principal: number;
  annualRate: number;
  emiAmount: number;
  maxMonths?: number;
};

export type LoanProjectionResult = {
  months: number;
  totalInterest: number;
  totalPrincipal: number;
  totalPaid: number;
};

export type FlexibleLoanPaymentSimulationInput = {
  amountPaid: number;
  currentOutstanding: number;
  currentLoanStatus: LoanStatus;
};

export type FlexibleLoanPaymentSimulationResult = {
  amountPaid: number;
  allocationPrincipal: number;
  allocationInterest: number;
  allocationFees: number;
  method: LoanPaymentMethod;
  nextOutstanding: number;
  nextLoanStatus: LoanStatus;
};

export type LoanScheduleRemainingInput = {
  principalDue: number;
  interestDue: number;
  feesDue: number;
  principalPaid?: number;
  interestPaid?: number;
  feesPaid?: number;
  amountPaid?: number;
};

export type LoanScheduleRemainingResult = {
  principalPaid: number;
  interestPaid: number;
  feesPaid: number;
  paidTotal: number;
  remainingPrincipalDue: number;
  remainingInterestDue: number;
  remainingFeesDue: number;
  remainingTotalDue: number;
};

export type EstimateLoanRateRevisionImpactInput = {
  currentOutstanding: number;
  currentRate: number;
  revisedRate: number;
  currentEmi: number;
  fallbackTenureMonths: number;
  fallbackFirstDueDate: string;
  scheduleRows: LoanScheduleItem[];
};

export type LoanRateRevisionImpactResult = {
  currentEmi: number;
  revisedEmi: number;
  remainingInstallments: number;
  currentPayoffDate: string | null;
  revisedPayoffDate: string | null;
  revisedPayoffMonths: number | null;
  payoffDeltaMonths: number | null;
};

export const calculateLoanEmi = (
  principal: number,
  annualRate: number,
  tenureMonths: number
) => {
  if (principal <= 0 || tenureMonths <= 0) {
    return 0;
  }
  const monthlyRate = annualRate / 1200;
  if (monthlyRate <= 0) {
    return round2(principal / tenureMonths);
  }
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  return round2(emi);
};

export const buildLoanSchedule = ({
  principal,
  annualRate,
  tenureMonths,
  firstDueDate,
  emiAmount,
  feesDue = 0,
}: BuildLoanScheduleArgs): LoanScheduleBuildItem[] => {
  if (
    principal <= 0 ||
    tenureMonths <= 0 ||
    !firstDueDate ||
    emiAmount <= 0 ||
    Number.isNaN(principal) ||
    Number.isNaN(tenureMonths) ||
    Number.isNaN(emiAmount)
  ) {
    return [];
  }

  const schedule: LoanScheduleBuildItem[] = [];
  const monthlyRate = annualRate / 1200;
  const safeFees = Math.max(0, round2(feesDue));
  let outstanding = round2(principal);

  for (let index = 0; index < tenureMonths && outstanding > 0.01; index += 1) {
    const opening = round2(outstanding);
    const interest = monthlyRate > 0 ? round2(opening * monthlyRate) : 0;
    const maxPrincipalPayable = Math.max(0, round2(opening));
    const basePrincipal = round2(emiAmount - interest);
    const principalDue = Math.min(maxPrincipalPayable, Math.max(0, basePrincipal));
    const emiDue = round2(interest + principalDue);
    const closing = round2(Math.max(0, opening - principalDue));

    schedule.push({
      installment_no: index + 1,
      due_date: dayjs(firstDueDate).add(index, "month").format("YYYY-MM-DD"),
      opening_principal: opening,
      interest_due: interest,
      principal_due: principalDue,
      emi_due: emiDue,
      fees_due: safeFees,
      principal_paid: 0,
      interest_paid: 0,
      fees_paid: 0,
      amount_paid: 0,
      closing_principal_expected: closing,
      status: "due",
      paid_date: null,
    });

    outstanding = closing;
  }

  return schedule;
};

export const classifyLoanScheduleStatus = (
  dueDate: string,
  status: LoanScheduleStatus
) => {
  if (status === "paid" || status === "skipped") {
    return status;
  }
  if (dayjs(dueDate).isBefore(dayjs(), "day")) {
    return "overdue" as const;
  }
  return status;
};

export const getLoanSummary = (
  outstanding: number,
  principal: number
) => {
  const safeOutstanding = Math.max(0, round2(outstanding));
  const safePrincipal = Math.max(0, round2(principal));
  const repaid = Math.max(0, round2(safePrincipal - safeOutstanding));
  const progress =
    safePrincipal > 0 ? Math.min(100, Math.round((repaid / safePrincipal) * 100)) : 0;
  return {
    outstanding: safeOutstanding,
    principal: safePrincipal,
    repaid,
    progress,
  };
};

export const isFlexibleLoan = (repaymentMode: LoanRepaymentMode | null | undefined) =>
  repaymentMode === "flexible";

export const simulateFlexibleLoanPayment = ({
  amountPaid,
  currentOutstanding,
  currentLoanStatus,
}: FlexibleLoanPaymentSimulationInput): FlexibleLoanPaymentSimulationResult => {
  const safeOutstanding = round2(Math.max(0, Number(currentOutstanding)));
  const safeAmount = round2(Math.max(0, Number(amountPaid)));
  const allocationPrincipal = round2(Math.min(safeAmount, safeOutstanding));
  const nextOutstanding = round2(Math.max(0, safeOutstanding - allocationPrincipal));

  let nextLoanStatus: LoanStatus = currentLoanStatus;
  if (nextOutstanding <= 0.01) {
    nextLoanStatus = "closed";
  } else if (currentLoanStatus === "closed") {
    nextLoanStatus = "active";
  }

  return {
    amountPaid: safeAmount,
    allocationPrincipal,
    allocationInterest: 0,
    allocationFees: 0,
    method: "prepayment",
    nextOutstanding,
    nextLoanStatus,
  };
};

export const estimateLoanPayoffMonths = ({
  principal,
  annualRate,
  emiAmount,
  maxMonths = 600,
}: EstimateLoanPayoffMonthsInput) => {
  const safePrincipal = round2(Number(principal));
  const safeRate = Number(annualRate);
  const safeEmi = round2(Number(emiAmount));
  if (
    Number.isNaN(safePrincipal) ||
    Number.isNaN(safeRate) ||
    Number.isNaN(safeEmi) ||
    safePrincipal <= 0 ||
    safeEmi <= 0
  ) {
    return null;
  }

  let outstanding = safePrincipal;
  const monthlyRate = safeRate / 1200;
  let monthCount = 0;

  while (outstanding > 0.01 && monthCount < maxMonths) {
    const interest = monthlyRate > 0 ? round2(outstanding * monthlyRate) : 0;
    const principalPaid = round2(safeEmi - interest);
    if (principalPaid <= 0) {
      return null;
    }
    outstanding = round2(Math.max(0, outstanding - principalPaid));
    monthCount += 1;
  }

  if (outstanding > 0.01) {
    return null;
  }
  return monthCount;
};

export const estimateLoanProjection = ({
  principal,
  annualRate,
  emiAmount,
  maxMonths = 600,
}: EstimateLoanPayoffMonthsInput): LoanProjectionResult | null => {
  const safePrincipal = round2(Number(principal));
  const safeRate = Number(annualRate);
  const safeEmi = round2(Number(emiAmount));
  if (
    Number.isNaN(safePrincipal) ||
    Number.isNaN(safeRate) ||
    Number.isNaN(safeEmi) ||
    safePrincipal <= 0 ||
    safeEmi <= 0
  ) {
    return null;
  }

  let outstanding = safePrincipal;
  const monthlyRate = safeRate / 1200;
  let monthCount = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalPaid = 0;

  while (outstanding > 0.01 && monthCount < maxMonths) {
    const interest = monthlyRate > 0 ? round2(outstanding * monthlyRate) : 0;
    const principalCandidate = round2(safeEmi - interest);
    if (principalCandidate <= 0) {
      return null;
    }
    const principalPaid = round2(Math.min(outstanding, principalCandidate));
    const paidThisMonth = round2(interest + principalPaid);
    outstanding = round2(Math.max(0, outstanding - principalPaid));
    monthCount += 1;
    totalInterest = round2(totalInterest + interest);
    totalPrincipal = round2(totalPrincipal + principalPaid);
    totalPaid = round2(totalPaid + paidThisMonth);
  }

  if (outstanding > 0.01) {
    return null;
  }

  return {
    months: monthCount,
    totalInterest,
    totalPrincipal,
    totalPaid,
  };
};

export const getLoanScheduleRemaining = ({
  principalDue,
  interestDue,
  feesDue,
  principalPaid = 0,
  interestPaid = 0,
  feesPaid = 0,
  amountPaid,
}: LoanScheduleRemainingInput): LoanScheduleRemainingResult => {
  const safePrincipalDue = Math.max(0, round2(Number(principalDue)));
  const safeInterestDue = Math.max(0, round2(Number(interestDue)));
  const safeFeesDue = Math.max(0, round2(Number(feesDue)));
  const safePrincipalPaid = Math.max(0, round2(Number(principalPaid)));
  const safeInterestPaid = Math.max(0, round2(Number(interestPaid)));
  const safeFeesPaid = Math.max(0, round2(Number(feesPaid)));

  const componentPaidTotal = round2(
    safePrincipalPaid + safeInterestPaid + safeFeesPaid
  );
  const safeAmountPaid = amountPaid === undefined ? null : Number(amountPaid);
  const paidTotal =
    safeAmountPaid === null || Number.isNaN(safeAmountPaid)
      ? componentPaidTotal
      : Math.max(componentPaidTotal, Math.max(0, round2(safeAmountPaid)));

  const remainingPrincipalDue = round2(
    Math.max(0, safePrincipalDue - safePrincipalPaid)
  );
  const remainingInterestDue = round2(
    Math.max(0, safeInterestDue - safeInterestPaid)
  );
  const remainingFeesDue = round2(Math.max(0, safeFeesDue - safeFeesPaid));
  const remainingTotalDue = round2(
    remainingPrincipalDue + remainingInterestDue + remainingFeesDue
  );

  return {
    principalPaid: safePrincipalPaid,
    interestPaid: safeInterestPaid,
    feesPaid: safeFeesPaid,
    paidTotal,
    remainingPrincipalDue,
    remainingInterestDue,
    remainingFeesDue,
    remainingTotalDue,
  };
};

const isOpenScheduleStatus = (status: LoanScheduleStatus) =>
  status !== "paid" && status !== "skipped";

export const getOpenLoanScheduleRows = (scheduleRows: LoanScheduleItem[]) =>
  scheduleRows
    .filter((row) => isOpenScheduleStatus(row.status))
    .sort((a, b) => {
      const dueCompare = a.due_date.localeCompare(b.due_date);
      if (dueCompare !== 0) {
        return dueCompare;
      }
      return a.installment_no - b.installment_no;
    });

export const estimateLoanRateRevisionImpact = ({
  currentOutstanding,
  currentRate,
  revisedRate,
  currentEmi,
  fallbackTenureMonths,
  fallbackFirstDueDate,
  scheduleRows,
}: EstimateLoanRateRevisionImpactInput): LoanRateRevisionImpactResult => {
  const openRows = getOpenLoanScheduleRows(scheduleRows);
  const safeCurrentEmi = round2(Number(currentEmi));
  let currentPayoffDate =
    openRows.length > 0 ? openRows[openRows.length - 1]?.due_date ?? null : null;
  const firstDueDate = openRows[0]?.due_date ?? fallbackFirstDueDate;
  const remainingInstallments =
    openRows.length > 0 ? openRows.length : Math.max(1, Number(fallbackTenureMonths));

  if (!currentPayoffDate && firstDueDate) {
    const currentPayoffMonths = estimateLoanPayoffMonths({
      principal: Number(currentOutstanding),
      annualRate: Number(currentRate),
      emiAmount: safeCurrentEmi,
    });
    if (currentPayoffMonths) {
      currentPayoffDate = dayjs(firstDueDate)
        .add(currentPayoffMonths - 1, "month")
        .format("YYYY-MM-DD");
    }
  }

  const revisedEmi = calculateLoanEmi(
    Number(currentOutstanding),
    Number(revisedRate),
    remainingInstallments
  );

  const revisedPayoffMonths = estimateLoanPayoffMonths({
    principal: Number(currentOutstanding),
    annualRate: Number(revisedRate),
    emiAmount: safeCurrentEmi,
  });
  const revisedPayoffDate =
    revisedPayoffMonths && firstDueDate
      ? dayjs(firstDueDate).add(revisedPayoffMonths - 1, "month").format("YYYY-MM-DD")
      : null;

  let payoffDeltaMonths: number | null = null;
  if (currentPayoffDate && revisedPayoffDate) {
    payoffDeltaMonths = dayjs(revisedPayoffDate)
      .startOf("month")
      .diff(dayjs(currentPayoffDate).startOf("month"), "month");
  }

  return {
    currentEmi: safeCurrentEmi,
    revisedEmi,
    remainingInstallments,
    currentPayoffDate,
    revisedPayoffDate,
    revisedPayoffMonths,
    payoffDeltaMonths,
  };
};

export const simulateLoanPayment = ({
  amountPaid,
  openingPrincipal,
  principalDue,
  interestDue,
  feesDue,
  dueTotal,
  currentOutstanding,
  currentLoanStatus,
}: LoanPaymentAllocationInput): LoanPaymentAllocationResult => {
  const safeAmount = round2(Number(amountPaid));
  const safeOpening = round2(Number(openingPrincipal));
  const safePrincipalDue = round2(Number(principalDue));
  const safeInterestDue = round2(Number(interestDue));
  const safeFeesDue = round2(Number(feesDue));
  const safeDueTotal = round2(Number(dueTotal));
  const safeOutstanding = round2(Number(currentOutstanding));

  let remaining = Math.max(0, safeAmount);
  const allocationFees = round2(Math.min(remaining, Math.max(0, safeFeesDue)));
  remaining = round2(remaining - allocationFees);

  const allocationInterest = round2(Math.min(remaining, Math.max(0, safeInterestDue)));
  remaining = round2(remaining - allocationInterest);

  let allocationPrincipal = round2(Math.min(remaining, Math.max(0, safeOpening)));
  remaining = round2(remaining - allocationPrincipal);

  if (remaining > 0) {
    allocationPrincipal = round2(
      Math.min(Math.max(0, safeOpening), allocationPrincipal + remaining)
    );
  }

  const method: LoanPaymentMethod =
    allocationPrincipal > safePrincipalDue + 0.01 ? "prepayment" : "emi";
  const nextScheduleStatus: LoanScheduleStatus =
    safeAmount + 0.01 >= safeDueTotal ? "paid" : "partial";
  const nextOutstanding = round2(Math.max(0, safeOutstanding - allocationPrincipal));
  const nextLoanStatus: LoanStatus =
    nextOutstanding <= 0.01 ? "closed" : currentLoanStatus;

  return {
    amountPaid: safeAmount,
    allocationPrincipal,
    allocationInterest,
    allocationFees,
    method,
    nextScheduleStatus,
    nextOutstanding,
    nextLoanStatus,
  };
};
