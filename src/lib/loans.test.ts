import { describe, expect, it } from "vitest";
import {
  buildLoanSchedule,
  calculateLoanEmi,
  estimateLoanPayoffMonths,
  estimateLoanProjection,
  estimateLoanRateRevisionImpact,
  getLoanScheduleRemaining,
  getLoanSummary,
  isFlexibleLoan,
  simulateFlexibleLoanPayment,
  simulateLoanPayment,
} from "./loans";
import type { LoanScheduleItem, LoanScheduleStatus } from "../types/finance";

const makeScheduleRow = (
  id: string,
  installmentNo: number,
  dueDate: string,
  status: LoanScheduleStatus
): LoanScheduleItem => ({
  id,
  loan_id: "loan-1",
  installment_no: installmentNo,
  due_date: dueDate,
  opening_principal: 50000,
  interest_due: 500,
  principal_due: 8500,
  emi_due: 9000,
  fees_due: 0,
  principal_paid: 0,
  interest_paid: 0,
  fees_paid: 0,
  amount_paid: 0,
  closing_principal_expected: 41500,
  status,
  paid_date: null,
});

describe("loans helpers", () => {
  it("calculates EMI for reducing balance loan", () => {
    const emi = calculateLoanEmi(120000, 12, 12);
    expect(emi).toBeGreaterThan(10000);
    expect(emi).toBeLessThan(11000);
  });

  it("builds schedule rows with monotonically decreasing principal", () => {
    const emi = calculateLoanEmi(100000, 10, 12);
    const rows = buildLoanSchedule({
      principal: 100000,
      annualRate: 10,
      tenureMonths: 12,
      firstDueDate: "2026-03-05",
      emiAmount: emi,
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.opening_principal).toBe(100000);
    expect(rows[0]?.due_date).toBe("2026-03-05");
    const last = rows[rows.length - 1];
    expect(last?.closing_principal_expected).toBeGreaterThanOrEqual(0);
    expect(last?.closing_principal_expected).toBeLessThan(1);
  });

  it("returns repayment progress summary", () => {
    const summary = getLoanSummary(70000, 100000);
    expect(summary.repaid).toBe(30000);
    expect(summary.progress).toBe(30);
  });

  it("simulates a normal EMI split", () => {
    const result = simulateLoanPayment({
      amountPaid: 10662,
      openingPrincipal: 100000,
      principalDue: 9830,
      interestDue: 832,
      feesDue: 0,
      dueTotal: 10662,
      currentOutstanding: 100000,
      currentLoanStatus: "active",
    });

    expect(result.allocationFees).toBe(0);
    expect(result.allocationInterest).toBe(832);
    expect(result.allocationPrincipal).toBe(9830);
    expect(result.method).toBe("emi");
    expect(result.nextScheduleStatus).toBe("paid");
    expect(result.nextOutstanding).toBe(90170);
    expect(result.nextLoanStatus).toBe("active");
  });

  it("simulates prepayment when amount exceeds due", () => {
    const result = simulateLoanPayment({
      amountPaid: 20000,
      openingPrincipal: 100000,
      principalDue: 9830,
      interestDue: 832,
      feesDue: 0,
      dueTotal: 10662,
      currentOutstanding: 100000,
      currentLoanStatus: "active",
    });

    expect(result.allocationInterest).toBe(832);
    expect(result.allocationPrincipal).toBe(19168);
    expect(result.method).toBe("prepayment");
    expect(result.nextScheduleStatus).toBe("paid");
    expect(result.nextOutstanding).toBe(80832);
  });

  it("detects flexible repayment mode explicitly", () => {
    expect(isFlexibleLoan("flexible")).toBe(true);
    expect(isFlexibleLoan("scheduled")).toBe(false);
    expect(isFlexibleLoan(null)).toBe(false);
  });

  it("simulates a flexible loan payment as principal-only repayment", () => {
    const result = simulateFlexibleLoanPayment({
      amountPaid: 25000,
      currentOutstanding: 250000,
      currentLoanStatus: "active",
    });

    expect(result.allocationPrincipal).toBe(25000);
    expect(result.allocationInterest).toBe(0);
    expect(result.allocationFees).toBe(0);
    expect(result.method).toBe("prepayment");
    expect(result.nextOutstanding).toBe(225000);
    expect(result.nextLoanStatus).toBe("active");
  });

  it("closes a flexible loan when the lump-sum payment clears the balance", () => {
    const result = simulateFlexibleLoanPayment({
      amountPaid: 60000,
      currentOutstanding: 50000,
      currentLoanStatus: "active",
    });

    expect(result.allocationPrincipal).toBe(50000);
    expect(result.nextOutstanding).toBe(0);
    expect(result.nextLoanStatus).toBe("closed");
  });

  it("computes remaining installment due from paid components", () => {
    const remaining = getLoanScheduleRemaining({
      principalDue: 8500,
      interestDue: 500,
      feesDue: 200,
      principalPaid: 3000,
      interestPaid: 500,
      feesPaid: 100,
      amountPaid: 3600,
    });

    expect(remaining.remainingPrincipalDue).toBe(5500);
    expect(remaining.remainingInterestDue).toBe(0);
    expect(remaining.remainingFeesDue).toBe(100);
    expect(remaining.remainingTotalDue).toBe(5600);
    expect(remaining.paidTotal).toBe(3600);
  });

  it("supports follow-up payment on a partial installment", () => {
    const remaining = getLoanScheduleRemaining({
      principalDue: 9830,
      interestDue: 832,
      feesDue: 0,
      principalPaid: 3000,
      interestPaid: 400,
      feesPaid: 0,
      amountPaid: 3400,
    });
    const result = simulateLoanPayment({
      amountPaid: 7262,
      openingPrincipal: 97000,
      principalDue: remaining.remainingPrincipalDue,
      interestDue: remaining.remainingInterestDue,
      feesDue: remaining.remainingFeesDue,
      dueTotal: remaining.remainingTotalDue,
      currentOutstanding: 97000,
      currentLoanStatus: "active",
    });

    expect(result.allocationInterest).toBe(432);
    expect(result.allocationPrincipal).toBe(6830);
    expect(result.nextScheduleStatus).toBe("paid");
    expect(result.method).toBe("emi");
    expect(result.nextOutstanding).toBe(90170);
  });

  it("estimates payoff months for a fixed EMI", () => {
    const months = estimateLoanPayoffMonths({
      principal: 50000,
      annualRate: 10,
      emiAmount: 9000,
    });

    expect(months).not.toBeNull();
    expect(months).toBeGreaterThan(0);
  });

  it("builds a payoff projection with total interest and months", () => {
    const projection = estimateLoanProjection({
      principal: 50000,
      annualRate: 10,
      emiAmount: 9000,
    });

    expect(projection).not.toBeNull();
    expect(projection?.months).toBeGreaterThan(0);
    expect(projection?.totalInterest).toBeGreaterThan(0);
    expect(projection?.totalPaid).toBeGreaterThan(projection?.totalPrincipal ?? 0);
  });

  it("uses actual remaining schedule rows for payoff date baseline", () => {
    const openRows = [
      makeScheduleRow("s1", 7, "2026-04-05", "due"),
      makeScheduleRow("s2", 8, "2026-05-05", "due"),
      makeScheduleRow("s3", 9, "2026-06-05", "overdue"),
      makeScheduleRow("s4", 10, "2026-07-05", "due"),
      makeScheduleRow("s5", 11, "2026-08-05", "partial"),
      makeScheduleRow("s6", 12, "2026-09-05", "due"),
    ];

    const impact = estimateLoanRateRevisionImpact({
      currentOutstanding: 50000,
      currentRate: 10,
      revisedRate: 20,
      currentEmi: 7000,
      fallbackTenureMonths: 12,
      fallbackFirstDueDate: "2026-04-05",
      scheduleRows: openRows,
    });

    expect(impact.remainingInstallments).toBe(6);
    expect(impact.currentPayoffDate).toBe("2026-09-05");
    expect(impact.revisedPayoffDate).not.toBeNull();
    expect(impact.payoffDeltaMonths).toBeGreaterThan(0);
  });
});
