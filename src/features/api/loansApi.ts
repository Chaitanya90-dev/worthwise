import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import { resolveCounterpartyFields } from "../../lib/counterparty";
import {
  buildLoanSchedule,
  getLoanScheduleRemaining,
  isFlexibleLoan,
  simulateFlexibleLoanPayment,
  simulateLoanPayment,
} from "../../lib/loans";
import type {
  Loan,
  LoanPayment,
  LoanPaymentMethod,
  LoanRepaymentMode,
  LoanRateRevision,
  LoanScheduleItem,
  LoanScheduleStatus,
} from "../../types/finance";
import type { DeleteByIdInput } from "./types";

type AddLoanInput = Omit<Loan, "id" | "principal_outstanding"> & {
  principal_outstanding?: number;
};

type UpdateLoanInput = Loan & {
  regenerate_schedule?: boolean;
};

type SetLoanStatusInput = {
  id: string;
  status: Loan["status"];
};

type AddLoanRateRevisionInput = {
  loan_id: string;
  effective_date: string;
  new_rate: number;
  note?: string | null;
  regenerate_schedule?: boolean;
};

type UpdateLoanPaymentInput = {
  id: string;
  payment_date: string;
  amount_paid: number;
  note?: string | null;
};

type ReverseLoanPaymentInput = {
  id: string;
};

type PostLoanPaymentInput = {
  loan_id: string;
  schedule_id: string;
  payment_date: string;
  amount_paid: number;
  account_id: string;
  payment_method_id?: string | null;
  category_id?: string | null;
  merchant?: string | null;
  note?: string | null;
};

type PostFlexibleLoanPaymentInput = {
  loan_id: string;
  payment_date: string;
  amount_paid: number;
  account_id: string;
  payment_method_id?: string | null;
  category_id?: string | null;
  merchant?: string | null;
  note?: string | null;
};

type LoanScheduleRow = {
  id: string;
  loan_id: string;
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
  loans?: { name: string } | { name: string }[] | null;
};

type LoanPaymentRow = {
  id: string;
  loan_id: string;
  schedule_id: string | null;
  payment_date: string;
  amount_paid: number;
  allocation_principal: number;
  allocation_interest: number;
  allocation_fees: number;
  schedule_allocation_principal?: number | null;
  schedule_allocation_interest?: number | null;
  schedule_allocation_fees?: number | null;
  method: LoanPaymentMethod;
  linked_transaction_id: string | null;
  note: string | null;
  created_at?: string;
  loans?: { name: string } | { name: string }[] | null;
};

type LoanRateRevisionRow = {
  id: string;
  loan_id: string;
  effective_date: string;
  previous_rate: number;
  new_rate: number;
  note: string | null;
  loans?: { name: string } | { name: string }[] | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const currentDateKey = () => new Date().toISOString().slice(0, 10);

const buildLoanPaymentTransactionNote = (loanName: string, note: string | null) => {
  if (note) {
    return `Loan payment · ${loanName} · ${note}`;
  }
  return `Loan payment · ${loanName}`;
};

const loanSelectColumns =
  "id, name, lender_name, loan_type, repayment_mode, principal_original, principal_outstanding, rate_type, rate_current, tenure_months, emi_amount, repayment_day, start_date, first_due_date, status, notes";

const resolveScheduleAppliedAllocation = ({
  storedAllocation,
  totalAllocation,
  currentPaid,
}: {
  storedAllocation: number;
  totalAllocation: number;
  currentPaid: number;
}) => {
  if (storedAllocation > 0) {
    return round2(Math.min(storedAllocation, currentPaid));
  }
  return round2(Math.min(totalAllocation, currentPaid));
};

const getScheduleStatusAfterUpdate = ({
  dueDate,
  remainingTotalDue,
  paidTotal,
}: {
  dueDate: string;
  remainingTotalDue: number;
  paidTotal: number;
}): LoanScheduleStatus => {
  if (remainingTotalDue <= 0.01) {
    return "paid";
  }
  if (paidTotal > 0.01) {
    return "partial";
  }
  return dueDate < currentDateKey() ? "overdue" : "due";
};

const mapLoan = (row: Record<string, unknown>): Loan => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  lender_name: (row.lender_name as string | null) ?? null,
  loan_type: (row.loan_type as string | null) ?? null,
  repayment_mode: ((row.repayment_mode as LoanRepaymentMode | null) ?? "scheduled"),
  principal_original: Number(row.principal_original ?? 0),
  principal_outstanding: Number(row.principal_outstanding ?? 0),
  rate_type: (row.rate_type as Loan["rate_type"]) ?? "fixed",
  rate_current: Number(row.rate_current ?? 0),
  tenure_months: Number(row.tenure_months ?? 0),
  emi_amount: Number(row.emi_amount ?? 0),
  repayment_day: Number(row.repayment_day ?? 1),
  start_date: String(row.start_date ?? ""),
  first_due_date: String(row.first_due_date ?? ""),
  status: (row.status as Loan["status"]) ?? "active",
  notes: (row.notes as string | null) ?? null,
});

const mapLoanSchedule = (row: LoanScheduleRow): LoanScheduleItem => {
  const loan = row.loans && Array.isArray(row.loans) ? row.loans[0] : row.loans;
  return {
    id: row.id,
    loan_id: row.loan_id,
    loan_name: loan?.name ?? null,
    installment_no: Number(row.installment_no ?? 0),
    due_date: row.due_date,
    opening_principal: Number(row.opening_principal ?? 0),
    interest_due: Number(row.interest_due ?? 0),
    principal_due: Number(row.principal_due ?? 0),
    emi_due: Number(row.emi_due ?? 0),
    fees_due: Number(row.fees_due ?? 0),
    principal_paid: Number(row.principal_paid ?? 0),
    interest_paid: Number(row.interest_paid ?? 0),
    fees_paid: Number(row.fees_paid ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    closing_principal_expected: Number(row.closing_principal_expected ?? 0),
    status: row.status ?? "due",
    paid_date: row.paid_date ?? null,
  };
};

const mapLoanPayment = (row: LoanPaymentRow): LoanPayment => {
  const loan = row.loans && Array.isArray(row.loans) ? row.loans[0] : row.loans;
  return {
    id: row.id,
    loan_id: row.loan_id,
    loan_name: loan?.name ?? null,
    schedule_id: row.schedule_id,
    payment_date: row.payment_date,
    amount_paid: Number(row.amount_paid ?? 0),
    allocation_principal: Number(row.allocation_principal ?? 0),
    allocation_interest: Number(row.allocation_interest ?? 0),
    allocation_fees: Number(row.allocation_fees ?? 0),
    schedule_allocation_principal: Number(row.schedule_allocation_principal ?? 0),
    schedule_allocation_interest: Number(row.schedule_allocation_interest ?? 0),
    schedule_allocation_fees: Number(row.schedule_allocation_fees ?? 0),
    method: (row.method as LoanPaymentMethod) ?? "emi",
    linked_transaction_id: row.linked_transaction_id,
    note: row.note ?? null,
  };
};

const mapLoanRateRevision = (row: LoanRateRevisionRow): LoanRateRevision => {
  const loan = row.loans && Array.isArray(row.loans) ? row.loans[0] : row.loans;
  return {
    id: row.id,
    loan_id: row.loan_id,
    loan_name: loan?.name ?? null,
    effective_date: row.effective_date,
    previous_rate: Number(row.previous_rate ?? 0),
    new_rate: Number(row.new_rate ?? 0),
    note: row.note ?? null,
  };
};

const regenerateOpenScheduleRows = async (loan: Loan) => {
  const { count: partialCount, error: partialCheckError } = await supabase
    .from("loan_schedule")
    .select("id", { count: "exact", head: true })
    .eq("loan_id", loan.id)
    .eq("status", "partial");
  if (partialCheckError) {
    return { error: partialCheckError };
  }
  if ((partialCount ?? 0) > 0) {
    return {
      error: {
        message:
          "Cannot regenerate schedule while a partial installment exists. Settle it first.",
      },
    };
  }

  const { error: clearOpenRowsError } = await supabase
    .from("loan_schedule")
    .delete()
    .eq("loan_id", loan.id)
    .in("status", ["due", "overdue", "skipped"]);
  if (clearOpenRowsError) {
    return { error: clearOpenRowsError };
  }

  const { data: latestRows, error: latestRowsError } = await supabase
    .from("loan_schedule")
    .select("installment_no")
    .eq("loan_id", loan.id)
    .order("installment_no", { ascending: false })
    .limit(1);
  if (latestRowsError) {
    return { error: latestRowsError };
  }
  const maxInstallmentNo = Number(latestRows?.[0]?.installment_no ?? 0);

  const scheduleRows = buildLoanSchedule({
    principal: loan.principal_outstanding,
    annualRate: loan.rate_current,
    tenureMonths: loan.tenure_months,
    firstDueDate: loan.first_due_date,
    emiAmount: loan.emi_amount,
    feesDue: 0,
  });

  if (scheduleRows.length > 0) {
    const { error: insertScheduleError } = await supabase.from("loan_schedule").insert(
      scheduleRows.map((row, index) => ({
        loan_id: loan.id,
        installment_no: maxInstallmentNo + index + 1,
        due_date: row.due_date,
        opening_principal: row.opening_principal,
        interest_due: row.interest_due,
        principal_due: row.principal_due,
        emi_due: row.emi_due,
        fees_due: row.fees_due,
        principal_paid: row.principal_paid,
        interest_paid: row.interest_paid,
        fees_paid: row.fees_paid,
        amount_paid: row.amount_paid,
        closing_principal_expected: row.closing_principal_expected,
        status: row.status,
        paid_date: row.paid_date,
      }))
    );
    if (insertScheduleError) {
      return { error: insertScheduleError };
    }
  }

  return { error: null };
};

export const loansApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getLoans: builder.query<Loan[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("loans")
          .select(loanSelectColumns)
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: (data ?? []).map((row) => mapLoan(row as Record<string, unknown>)),
        };
      },
      providesTags: (result) =>
        result
          ? [
              "Loans",
              ...result.map((loan) => ({ type: "Loans" as const, id: loan.id })),
            ]
          : ["Loans"],
    }),
    addLoan: builder.mutation<Loan, AddLoanInput>({
      async queryFn(input) {
        const principalOriginal = Number(input.principal_original);
        const principalOutstanding =
          input.principal_outstanding === undefined ||
          input.principal_outstanding === null
            ? principalOriginal
            : Number(input.principal_outstanding);
        const payload = {
          ...input,
          principal_original: principalOriginal,
          principal_outstanding: principalOutstanding,
          rate_current: Number(input.rate_current),
          tenure_months: Number(input.tenure_months),
          emi_amount: Number(input.emi_amount),
          repayment_day: Number(input.repayment_day),
        };

        const { data, error } = await supabase
          .from("loans")
          .insert(payload)
          .select(loanSelectColumns)
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const loan = mapLoan(data as Record<string, unknown>);
        const scheduleRows = isFlexibleLoan(loan.repayment_mode)
          ? []
          : buildLoanSchedule({
              principal: loan.principal_outstanding,
              annualRate: loan.rate_current,
              tenureMonths: loan.tenure_months,
              firstDueDate: loan.first_due_date,
              emiAmount: loan.emi_amount,
              feesDue: 0,
            });

        if (scheduleRows.length > 0) {
          const { error: scheduleError } = await supabase.from("loan_schedule").insert(
            scheduleRows.map((row) => ({
              loan_id: loan.id,
              installment_no: row.installment_no,
              due_date: row.due_date,
              opening_principal: row.opening_principal,
              interest_due: row.interest_due,
              principal_due: row.principal_due,
              emi_due: row.emi_due,
              fees_due: row.fees_due,
              principal_paid: row.principal_paid,
              interest_paid: row.interest_paid,
              fees_paid: row.fees_paid,
              amount_paid: row.amount_paid,
              closing_principal_expected: row.closing_principal_expected,
              status: row.status,
              paid_date: row.paid_date,
            }))
          );

          if (scheduleError) {
            await supabase.from("loans").delete().eq("id", loan.id);
            return {
              error: { message: normalizeApiErrorMessage(scheduleError) },
            };
          }
        }

        return { data: loan };
      },
      invalidatesTags: ["Loans", "LoanSchedule"],
    }),
    updateLoan: builder.mutation<Loan, UpdateLoanInput>({
      async queryFn({ id, regenerate_schedule = false, ...rest }) {
        const payload = {
          ...rest,
          principal_original: Number(rest.principal_original),
          principal_outstanding: Number(rest.principal_outstanding),
          rate_current: Number(rest.rate_current),
          tenure_months: Number(rest.tenure_months),
          emi_amount: Number(rest.emi_amount),
          repayment_day: Number(rest.repayment_day),
        };
        const { data, error } = await supabase
          .from("loans")
          .update(payload)
          .eq("id", id)
          .select(loanSelectColumns)
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const updatedLoan = mapLoan(data as Record<string, unknown>);

        if (regenerate_schedule && !isFlexibleLoan(updatedLoan.repayment_mode)) {
          const { error: regenerateError } = await regenerateOpenScheduleRows(updatedLoan);
          if (regenerateError) {
            return {
              error: {
                message: normalizeApiErrorMessage(
                  regenerateError as { message?: string; code?: string }
                ),
              },
            };
          }
        }

        return { data: updatedLoan };
      },
      invalidatesTags: ["Loans", "LoanSchedule"],
    }),
    getLoanRateRevisions: builder.query<LoanRateRevision[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("loan_rate_revisions")
          .select("id, loan_id, effective_date, previous_rate, new_rate, note, loans(name)")
          .order("effective_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: ((data ?? []) as LoanRateRevisionRow[]).map((row) =>
            mapLoanRateRevision(row)
          ),
        };
      },
      providesTags: (result) =>
        result
          ? [
              "LoanRateRevisions",
              ...result.map((item) => ({
                type: "LoanRateRevisions" as const,
                id: item.id,
              })),
            ]
          : ["LoanRateRevisions"],
    }),
    addLoanRateRevision: builder.mutation<LoanRateRevision, AddLoanRateRevisionInput>({
      async queryFn(input) {
        const { data: loanData, error: loanError } = await supabase
          .from("loans")
          .select(loanSelectColumns)
          .eq("id", input.loan_id)
          .single();
        if (loanError || !loanData) {
          return { error: { message: normalizeApiErrorMessage(loanError) } };
        }
        const loan = mapLoan(loanData as Record<string, unknown>);
        if (isFlexibleLoan(loan.repayment_mode)) {
          return {
            error: {
              message: "Rate revisions are only available for scheduled loans.",
            },
          };
        }
        const nextRate = Number(input.new_rate);
        if (!nextRate || Number.isNaN(nextRate) || nextRate < 0) {
          return { error: { message: "Enter a valid revised interest rate." } };
        }
        if (input.regenerate_schedule) {
          const { count: partialCount, error: partialCheckError } = await supabase
            .from("loan_schedule")
            .select("id", { count: "exact", head: true })
            .eq("loan_id", input.loan_id)
            .eq("status", "partial");
          if (partialCheckError) {
            return {
              error: { message: normalizeApiErrorMessage(partialCheckError) },
            };
          }
          if ((partialCount ?? 0) > 0) {
            return {
              error: {
                message:
                  "Cannot regenerate schedule while a partial installment exists. Settle it first.",
              },
            };
          }
        }

        const { data: insertedRevision, error: revisionError } = await supabase
          .from("loan_rate_revisions")
          .insert({
            loan_id: input.loan_id,
            effective_date: input.effective_date,
            previous_rate: loan.rate_current,
            new_rate: nextRate,
            note: input.note?.trim() ? input.note.trim() : null,
          })
          .select("id, loan_id, effective_date, previous_rate, new_rate, note, loans(name)")
          .single();
        if (revisionError || !insertedRevision) {
          return { error: { message: normalizeApiErrorMessage(revisionError) } };
        }

        const { error: loanUpdateError } = await supabase
          .from("loans")
          .update({ rate_current: nextRate })
          .eq("id", input.loan_id);
        if (loanUpdateError) {
          await supabase.from("loan_rate_revisions").delete().eq("id", insertedRevision.id);
          return { error: { message: normalizeApiErrorMessage(loanUpdateError) } };
        }

        if (input.regenerate_schedule) {
          const updatedLoan: Loan = {
            ...loan,
            rate_current: nextRate,
          };
          const { error: regenerateError } = await regenerateOpenScheduleRows(updatedLoan);
          if (regenerateError) {
            return {
              error: {
                message: normalizeApiErrorMessage(
                  regenerateError as { message?: string; code?: string }
                ),
              },
            };
          }
        }

        return { data: mapLoanRateRevision(insertedRevision as LoanRateRevisionRow) };
      },
      invalidatesTags: ["Loans", "LoanSchedule", "LoanRateRevisions"],
    }),
    setLoanStatus: builder.mutation<Loan, SetLoanStatusInput>({
      async queryFn({ id, status }) {
        const { data, error } = await supabase
          .from("loans")
          .update({ status })
          .eq("id", id)
          .select(loanSelectColumns)
          .single();
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        if (status === "closed") {
          const { error: scheduleUpdateError } = await supabase
            .from("loan_schedule")
            .update({ status: "skipped" })
            .eq("loan_id", id)
            .in("status", ["due", "overdue"]);
          if (scheduleUpdateError) {
            return {
              error: { message: normalizeApiErrorMessage(scheduleUpdateError) },
            };
          }
        }

        return { data: mapLoan(data as Record<string, unknown>) };
      },
      invalidatesTags: ["Loans", "LoanSchedule"],
    }),
    deleteLoan: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase.from("loans").delete().eq("id", id);
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: undefined };
      },
      invalidatesTags: ["Loans", "LoanSchedule", "LoanPayments"],
    }),
    getLoanSchedule: builder.query<LoanScheduleItem[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("loan_schedule")
          .select(
            "id, loan_id, installment_no, due_date, opening_principal, interest_due, principal_due, emi_due, fees_due, principal_paid, interest_paid, fees_paid, amount_paid, closing_principal_expected, status, paid_date, loans(name)"
          )
          .order("due_date", { ascending: true })
          .order("installment_no", { ascending: true });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const rows = (data ?? []) as LoanScheduleRow[];
        return { data: rows.map((row) => mapLoanSchedule(row)) };
      },
      providesTags: (result) =>
        result
          ? [
              "LoanSchedule",
              ...result.map((item) => ({
                type: "LoanSchedule" as const,
                id: item.id,
              })),
            ]
          : ["LoanSchedule"],
    }),
    getLoanPayments: builder.query<LoanPayment[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("loan_payments")
          .select(
            "id, loan_id, schedule_id, payment_date, amount_paid, allocation_principal, allocation_interest, allocation_fees, schedule_allocation_principal, schedule_allocation_interest, schedule_allocation_fees, method, linked_transaction_id, note, loans(name)"
          )
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const rows = (data ?? []) as LoanPaymentRow[];
        return { data: rows.map((row) => mapLoanPayment(row)) };
      },
      providesTags: (result) =>
        result
          ? [
              "LoanPayments",
              ...result.map((item) => ({
                type: "LoanPayments" as const,
                id: item.id,
              })),
            ]
          : ["LoanPayments"],
    }),
    postLoanPayment: builder.mutation<LoanPayment, PostLoanPaymentInput>({
      async queryFn(input) {
        const { data: loanData, error: loanError } = await supabase
          .from("loans")
          .select("id, name, lender_name, principal_outstanding, status")
          .eq("id", input.loan_id)
          .single();
        if (loanError || !loanData) {
          return { error: { message: normalizeApiErrorMessage(loanError) } };
        }

        const { data: scheduleData, error: scheduleError } = await supabase
          .from("loan_schedule")
          .select(
            "id, status, paid_date, opening_principal, principal_due, interest_due, fees_due, emi_due, principal_paid, interest_paid, fees_paid, amount_paid"
          )
          .eq("id", input.schedule_id)
          .eq("loan_id", input.loan_id)
          .single();
        if (scheduleError || !scheduleData) {
          return { error: { message: normalizeApiErrorMessage(scheduleError) } };
        }

        if (scheduleData.status === "paid") {
          return { error: { message: "Installment is already marked as paid." } };
        }

        const amountPaid = round2(Number(input.amount_paid));
        if (!amountPaid || Number.isNaN(amountPaid) || amountPaid <= 0) {
          return { error: { message: "Enter a valid payment amount." } };
        }

        const remaining = getLoanScheduleRemaining({
          principalDue: Number(scheduleData.principal_due ?? 0),
          interestDue: Number(scheduleData.interest_due ?? 0),
          feesDue: Number(scheduleData.fees_due ?? 0),
          principalPaid: Number(scheduleData.principal_paid ?? 0),
          interestPaid: Number(scheduleData.interest_paid ?? 0),
          feesPaid: Number(scheduleData.fees_paid ?? 0),
          amountPaid: Number(scheduleData.amount_paid ?? 0),
        });
        if (remaining.remainingTotalDue <= 0.01) {
          return {
            error: {
              message:
                "Installment due is already settled. Pick the next due installment.",
            },
          };
        }

        const simulation = simulateLoanPayment({
          amountPaid,
          openingPrincipal: Number(loanData.principal_outstanding ?? 0),
          principalDue: remaining.remainingPrincipalDue,
          interestDue: remaining.remainingInterestDue,
          feesDue: remaining.remainingFeesDue,
          dueTotal: remaining.remainingTotalDue,
          currentOutstanding: Number(loanData.principal_outstanding ?? 0),
          currentLoanStatus: (loanData.status as Loan["status"]) ?? "active",
        });
        const allocationFees = simulation.allocationFees;
        const allocationInterest = simulation.allocationInterest;
        const allocationPrincipal = simulation.allocationPrincipal;
        const allocationToDueFees = round2(
          Math.min(allocationFees, remaining.remainingFeesDue)
        );
        const allocationToDueInterest = round2(
          Math.min(allocationInterest, remaining.remainingInterestDue)
        );
        const allocationToDuePrincipal = round2(
          Math.min(allocationPrincipal, remaining.remainingPrincipalDue)
        );
        const allocationToDueTotal = round2(
          allocationToDueFees + allocationToDueInterest + allocationToDuePrincipal
        );
        const nextPrincipalPaid = round2(
          remaining.principalPaid + allocationToDuePrincipal
        );
        const nextInterestPaid = round2(
          remaining.interestPaid + allocationToDueInterest
        );
        const nextFeesPaid = round2(remaining.feesPaid + allocationToDueFees);
        const nextAmountPaid = round2(remaining.paidTotal + allocationToDueTotal);
        const method: LoanPaymentMethod = simulation.method;
        const counterparty = resolveCounterpartyFields({
          merchant: input.merchant ?? loanData.lender_name ?? loanData.name,
          counterpartyKind: "biller",
        });
        const noteText = input.note?.trim() ? input.note.trim() : null;
        const transactionNote = buildLoanPaymentTransactionNote(loanData.name, noteText);

        let transactionId: string | null = null;
        let paymentId: string | null = null;
        const oldStatus = scheduleData.status as LoanScheduleStatus;
        const oldPaidDate = (scheduleData.paid_date as string | null) ?? null;
        const oldPrincipalPaid = Number(scheduleData.principal_paid ?? 0);
        const oldInterestPaid = Number(scheduleData.interest_paid ?? 0);
        const oldFeesPaid = Number(scheduleData.fees_paid ?? 0);
        const oldAmountPaid = Number(scheduleData.amount_paid ?? 0);

        try {
          const { data: txData, error: txError } = await supabase
            .from("transactions")
            .insert({
              type: "expense",
              date: input.payment_date,
              amount: amountPaid,
              category_id: input.category_id ?? null,
              payment_method_id: input.payment_method_id ?? null,
              account_id: input.account_id,
              counterparty_name: counterparty.counterparty_name,
              counterparty_kind: counterparty.counterparty_kind,
              merchant: counterparty.merchant,
              notes_enc: transactionNote,
              is_transfer: false,
              is_reimbursement: false,
              is_shared: false,
              reimbursement_category_id: null,
              reimbursement_of_transaction_id: null,
              is_recurring: false,
            })
            .select("id")
            .single();

          if (txError || !txData) {
            return { error: { message: normalizeApiErrorMessage(txError) } };
          }
          transactionId = txData.id;

          const { data: paymentData, error: paymentError } = await supabase
            .from("loan_payments")
            .insert({
              loan_id: input.loan_id,
              schedule_id: input.schedule_id,
              payment_date: input.payment_date,
              amount_paid: amountPaid,
              allocation_principal: allocationPrincipal,
              allocation_interest: allocationInterest,
              allocation_fees: allocationFees,
              schedule_allocation_principal: allocationToDuePrincipal,
              schedule_allocation_interest: allocationToDueInterest,
              schedule_allocation_fees: allocationToDueFees,
              method,
              linked_transaction_id: transactionId,
              note: noteText,
            })
            .select(
              "id, loan_id, schedule_id, payment_date, amount_paid, allocation_principal, allocation_interest, allocation_fees, schedule_allocation_principal, schedule_allocation_interest, schedule_allocation_fees, method, linked_transaction_id, note, loans(name)"
            )
            .single();

          if (paymentError || !paymentData) {
            await supabase.from("transactions").delete().eq("id", transactionId);
            return { error: { message: normalizeApiErrorMessage(paymentError) } };
          }
          paymentId = paymentData.id;

          const nextScheduleStatus: LoanScheduleStatus = simulation.nextScheduleStatus;
          const nextPaidDate = nextScheduleStatus === "paid" ? input.payment_date : null;

          const { error: scheduleUpdateError } = await supabase
            .from("loan_schedule")
            .update({
              status: nextScheduleStatus,
              paid_date: nextPaidDate,
              principal_paid: nextPrincipalPaid,
              interest_paid: nextInterestPaid,
              fees_paid: nextFeesPaid,
              amount_paid: nextAmountPaid,
            })
            .eq("id", input.schedule_id);
          if (scheduleUpdateError) {
            throw scheduleUpdateError;
          }

          const nextOutstanding = simulation.nextOutstanding;
          const nextLoanStatus: Loan["status"] = simulation.nextLoanStatus;

          const { error: loanUpdateError } = await supabase
            .from("loans")
            .update({
              principal_outstanding: nextOutstanding,
              status: nextLoanStatus,
            })
            .eq("id", input.loan_id);
          if (loanUpdateError) {
            throw loanUpdateError;
          }

          return {
            data: mapLoanPayment(paymentData as LoanPaymentRow),
          };
        } catch (rawError) {
          if (paymentId) {
            await supabase.from("loan_payments").delete().eq("id", paymentId);
          }
          if (transactionId) {
            await supabase.from("transactions").delete().eq("id", transactionId);
          }
          await supabase
            .from("loan_schedule")
            .update({
              status: oldStatus,
              paid_date: oldPaidDate,
              principal_paid: oldPrincipalPaid,
              interest_paid: oldInterestPaid,
              fees_paid: oldFeesPaid,
              amount_paid: oldAmountPaid,
            })
            .eq("id", input.schedule_id);
          return {
            error: {
              message: normalizeApiErrorMessage(
                typeof rawError === "object" && rawError !== null
                  ? (rawError as { message?: string; code?: string })
                  : { message: "Unable to post loan payment." }
              ),
            },
          };
        }
      },
      invalidatesTags: [
        "Loans",
        "LoanSchedule",
        "LoanPayments",
        "Transactions",
        "Accounts",
      ],
    }),
    postFlexibleLoanPayment: builder.mutation<LoanPayment, PostFlexibleLoanPaymentInput>({
      async queryFn(input) {
        const { data: loanData, error: loanError } = await supabase
          .from("loans")
          .select("id, name, lender_name, repayment_mode, principal_outstanding, status")
          .eq("id", input.loan_id)
          .single();
        if (loanError || !loanData) {
          return { error: { message: normalizeApiErrorMessage(loanError) } };
        }

        const repaymentMode = (loanData.repayment_mode as LoanRepaymentMode | null) ?? "scheduled";
        if (!isFlexibleLoan(repaymentMode)) {
          return {
            error: {
              message: "Direct payments are only available for flexible loans.",
            },
          };
        }

        const amountPaid = round2(Number(input.amount_paid));
        if (!amountPaid || Number.isNaN(amountPaid) || amountPaid <= 0) {
          return { error: { message: "Enter a valid payment amount." } };
        }

        const outstanding = Number(loanData.principal_outstanding ?? 0);
        if (outstanding <= 0.01) {
          return {
            error: {
              message: "This loan is already fully paid off.",
            },
          };
        }

        const simulation = simulateFlexibleLoanPayment({
          amountPaid,
          currentOutstanding: outstanding,
          currentLoanStatus: (loanData.status as Loan["status"]) ?? "active",
        });
        const counterparty = resolveCounterpartyFields({
          merchant: input.merchant ?? loanData.lender_name ?? loanData.name,
          counterpartyKind: "biller",
        });
        const noteText = input.note?.trim() ? input.note.trim() : null;
        const transactionNote = buildLoanPaymentTransactionNote(loanData.name, noteText);

        let transactionId: string | null = null;
        let paymentId: string | null = null;

        try {
          const { data: txData, error: txError } = await supabase
            .from("transactions")
            .insert({
              type: "expense",
              date: input.payment_date,
              amount: amountPaid,
              category_id: input.category_id ?? null,
              payment_method_id: input.payment_method_id ?? null,
              account_id: input.account_id,
              counterparty_name: counterparty.counterparty_name,
              counterparty_kind: counterparty.counterparty_kind,
              merchant: counterparty.merchant,
              notes_enc: transactionNote,
              is_transfer: false,
              is_reimbursement: false,
              is_shared: false,
              reimbursement_category_id: null,
              reimbursement_of_transaction_id: null,
              is_recurring: false,
            })
            .select("id")
            .single();

          if (txError || !txData) {
            return { error: { message: normalizeApiErrorMessage(txError) } };
          }
          transactionId = txData.id;

          const { data: paymentData, error: paymentError } = await supabase
            .from("loan_payments")
            .insert({
              loan_id: input.loan_id,
              schedule_id: null,
              payment_date: input.payment_date,
              amount_paid: amountPaid,
              allocation_principal: simulation.allocationPrincipal,
              allocation_interest: simulation.allocationInterest,
              allocation_fees: simulation.allocationFees,
              schedule_allocation_principal: 0,
              schedule_allocation_interest: 0,
              schedule_allocation_fees: 0,
              method: simulation.method,
              linked_transaction_id: transactionId,
              note: noteText,
            })
            .select(
              "id, loan_id, schedule_id, payment_date, amount_paid, allocation_principal, allocation_interest, allocation_fees, schedule_allocation_principal, schedule_allocation_interest, schedule_allocation_fees, method, linked_transaction_id, note, loans(name)"
            )
            .single();

          if (paymentError || !paymentData) {
            await supabase.from("transactions").delete().eq("id", transactionId);
            return { error: { message: normalizeApiErrorMessage(paymentError) } };
          }
          paymentId = paymentData.id;

          const { error: loanUpdateError } = await supabase
            .from("loans")
            .update({
              principal_outstanding: simulation.nextOutstanding,
              status: simulation.nextLoanStatus,
            })
            .eq("id", input.loan_id);
          if (loanUpdateError) {
            throw loanUpdateError;
          }

          return {
            data: mapLoanPayment(paymentData as LoanPaymentRow),
          };
        } catch (rawError) {
          if (paymentId) {
            await supabase.from("loan_payments").delete().eq("id", paymentId);
          }
          if (transactionId) {
            await supabase.from("transactions").delete().eq("id", transactionId);
          }
          return {
            error: {
              message: normalizeApiErrorMessage(
                typeof rawError === "object" && rawError !== null
                  ? (rawError as { message?: string; code?: string })
                  : { message: "Unable to post loan payment." }
              ),
            },
          };
        }
      },
      invalidatesTags: [
        "Loans",
        "LoanPayments",
        "Transactions",
        "Accounts",
      ],
    }),
    updateLoanPayment: builder.mutation<LoanPayment, UpdateLoanPaymentInput>({
      async queryFn(input) {
        const amountPaid = round2(Number(input.amount_paid));
        if (!amountPaid || Number.isNaN(amountPaid) || amountPaid <= 0) {
          return { error: { message: "Enter a valid payment amount." } };
        }
        const noteText = input.note?.trim() ? input.note.trim() : null;

        const { data: paymentData, error: paymentError } = await supabase
          .from("loan_payments")
          .select(
            "id, loan_id, schedule_id, payment_date, amount_paid, allocation_principal, allocation_interest, allocation_fees, schedule_allocation_principal, schedule_allocation_interest, schedule_allocation_fees, method, linked_transaction_id, note"
          )
          .eq("id", input.id)
          .single();
        if (paymentError || !paymentData) {
          return { error: { message: normalizeApiErrorMessage(paymentError) } };
        }

        const payment = paymentData as LoanPaymentRow;
        if (!payment.schedule_id) {
          return {
            error: {
              message: "Only installment-linked payments can be edited right now.",
            },
          };
        }

        const { data: loanData, error: loanError } = await supabase
          .from("loans")
          .select("id, name, principal_original, principal_outstanding, status")
          .eq("id", payment.loan_id)
          .single();
        if (loanError || !loanData) {
          return { error: { message: normalizeApiErrorMessage(loanError) } };
        }

        const { data: scheduleData, error: scheduleError } = await supabase
          .from("loan_schedule")
          .select(
            "id, due_date, status, paid_date, principal_due, interest_due, fees_due, principal_paid, interest_paid, fees_paid, amount_paid"
          )
          .eq("id", payment.schedule_id)
          .eq("loan_id", payment.loan_id)
          .single();
        if (scheduleError || !scheduleData) {
          return { error: { message: normalizeApiErrorMessage(scheduleError) } };
        }

        const oldSchedule = {
          id: String(scheduleData.id),
          due_date: String(scheduleData.due_date),
          status: (scheduleData.status as LoanScheduleStatus) ?? "due",
          paid_date: (scheduleData.paid_date as string | null) ?? null,
          principal_due: Number(scheduleData.principal_due ?? 0),
          interest_due: Number(scheduleData.interest_due ?? 0),
          fees_due: Number(scheduleData.fees_due ?? 0),
          principal_paid: Number(scheduleData.principal_paid ?? 0),
          interest_paid: Number(scheduleData.interest_paid ?? 0),
          fees_paid: Number(scheduleData.fees_paid ?? 0),
          amount_paid: Number(scheduleData.amount_paid ?? 0),
        };
        const oldLoan = {
          id: String(loanData.id),
          principal_original: Number(loanData.principal_original ?? 0),
          principal_outstanding: Number(loanData.principal_outstanding ?? 0),
          status: (loanData.status as Loan["status"]) ?? "active",
        };
        const oldPayment = {
          id: payment.id,
          payment_date: payment.payment_date,
          amount_paid: Number(payment.amount_paid ?? 0),
          allocation_principal: Number(payment.allocation_principal ?? 0),
          allocation_interest: Number(payment.allocation_interest ?? 0),
          allocation_fees: Number(payment.allocation_fees ?? 0),
          schedule_allocation_principal: Number(
            payment.schedule_allocation_principal ?? 0
          ),
          schedule_allocation_interest: Number(
            payment.schedule_allocation_interest ?? 0
          ),
          schedule_allocation_fees: Number(payment.schedule_allocation_fees ?? 0),
          method: payment.method,
          note: payment.note ?? null,
        };

        let oldTransaction:
          | {
              id: string;
              date: string;
              amount: number;
              notes_enc: string | null;
            }
          | null = null;
        if (payment.linked_transaction_id) {
          const { data: transactionData, error: transactionError } = await supabase
            .from("transactions")
            .select("id, date, amount, notes_enc")
            .eq("id", payment.linked_transaction_id)
            .single();
          if (transactionError || !transactionData) {
            return { error: { message: normalizeApiErrorMessage(transactionError) } };
          }
          oldTransaction = {
            id: String(transactionData.id),
            date: String(transactionData.date),
            amount: Number(transactionData.amount ?? 0),
            notes_enc: (transactionData.notes_enc as string | null) ?? null,
          };
        }

        const oldAppliedPrincipal = resolveScheduleAppliedAllocation({
          storedAllocation: oldPayment.schedule_allocation_principal,
          totalAllocation: oldPayment.allocation_principal,
          currentPaid: oldSchedule.principal_paid,
        });
        const oldAppliedInterest = resolveScheduleAppliedAllocation({
          storedAllocation: oldPayment.schedule_allocation_interest,
          totalAllocation: oldPayment.allocation_interest,
          currentPaid: oldSchedule.interest_paid,
        });
        const oldAppliedFees = resolveScheduleAppliedAllocation({
          storedAllocation: oldPayment.schedule_allocation_fees,
          totalAllocation: oldPayment.allocation_fees,
          currentPaid: oldSchedule.fees_paid,
        });
        const oldAppliedTotal = round2(
          oldAppliedPrincipal + oldAppliedInterest + oldAppliedFees
        );

        const basePrincipalPaid = round2(
          Math.max(0, oldSchedule.principal_paid - oldAppliedPrincipal)
        );
        const baseInterestPaid = round2(
          Math.max(0, oldSchedule.interest_paid - oldAppliedInterest)
        );
        const baseFeesPaid = round2(Math.max(0, oldSchedule.fees_paid - oldAppliedFees));
        const baseAmountPaid = round2(
          Math.max(0, oldSchedule.amount_paid - oldAppliedTotal)
        );

        const baseOutstanding = round2(
          Math.min(
            oldLoan.principal_original > 0
              ? oldLoan.principal_original
              : Number.MAX_SAFE_INTEGER,
            oldLoan.principal_outstanding + oldPayment.allocation_principal
          )
        );
        let baseLoanStatus: Loan["status"] = oldLoan.status;
        if (baseOutstanding <= 0.01) {
          baseLoanStatus = "closed";
        } else if (oldLoan.status === "closed") {
          baseLoanStatus = "active";
        }

        const remaining = getLoanScheduleRemaining({
          principalDue: oldSchedule.principal_due,
          interestDue: oldSchedule.interest_due,
          feesDue: oldSchedule.fees_due,
          principalPaid: basePrincipalPaid,
          interestPaid: baseInterestPaid,
          feesPaid: baseFeesPaid,
          amountPaid: baseAmountPaid,
        });
        if (remaining.remainingTotalDue <= 0.01) {
          return {
            error: {
              message:
                "Installment due is already settled by other payments. Edit is blocked.",
            },
          };
        }

        const simulation = simulateLoanPayment({
          amountPaid,
          openingPrincipal: baseOutstanding,
          principalDue: remaining.remainingPrincipalDue,
          interestDue: remaining.remainingInterestDue,
          feesDue: remaining.remainingFeesDue,
          dueTotal: remaining.remainingTotalDue,
          currentOutstanding: baseOutstanding,
          currentLoanStatus: baseLoanStatus,
        });

        const allocationToDueFees = round2(
          Math.min(simulation.allocationFees, remaining.remainingFeesDue)
        );
        const allocationToDueInterest = round2(
          Math.min(simulation.allocationInterest, remaining.remainingInterestDue)
        );
        const allocationToDuePrincipal = round2(
          Math.min(simulation.allocationPrincipal, remaining.remainingPrincipalDue)
        );
        const allocationToDueTotal = round2(
          allocationToDueFees + allocationToDueInterest + allocationToDuePrincipal
        );

        const nextPrincipalPaid = round2(basePrincipalPaid + allocationToDuePrincipal);
        const nextInterestPaid = round2(baseInterestPaid + allocationToDueInterest);
        const nextFeesPaid = round2(baseFeesPaid + allocationToDueFees);
        const nextAmountPaid = round2(baseAmountPaid + allocationToDueTotal);
        const remainingAfterEdit = getLoanScheduleRemaining({
          principalDue: oldSchedule.principal_due,
          interestDue: oldSchedule.interest_due,
          feesDue: oldSchedule.fees_due,
          principalPaid: nextPrincipalPaid,
          interestPaid: nextInterestPaid,
          feesPaid: nextFeesPaid,
          amountPaid: nextAmountPaid,
        });
        const nextScheduleStatus = getScheduleStatusAfterUpdate({
          dueDate: oldSchedule.due_date,
          remainingTotalDue: remainingAfterEdit.remainingTotalDue,
          paidTotal: nextAmountPaid,
        });
        const nextPaidDate = nextScheduleStatus === "paid" ? input.payment_date : null;
        const nextOutstanding = simulation.nextOutstanding;
        const nextLoanStatus = simulation.nextLoanStatus;
        const transactionNote = buildLoanPaymentTransactionNote(
          String(loanData.name ?? "Loan"),
          noteText
        );

        let scheduleUpdated = false;
        let loanUpdated = false;
        let paymentUpdated = false;
        let transactionUpdated = false;

        try {
          const { error: scheduleUpdateError } = await supabase
            .from("loan_schedule")
            .update({
              status: nextScheduleStatus,
              paid_date: nextPaidDate,
              principal_paid: nextPrincipalPaid,
              interest_paid: nextInterestPaid,
              fees_paid: nextFeesPaid,
              amount_paid: nextAmountPaid,
            })
            .eq("id", oldSchedule.id);
          if (scheduleUpdateError) {
            throw scheduleUpdateError;
          }
          scheduleUpdated = true;

          const { error: loanUpdateError } = await supabase
            .from("loans")
            .update({
              principal_outstanding: nextOutstanding,
              status: nextLoanStatus,
            })
            .eq("id", oldLoan.id);
          if (loanUpdateError) {
            throw loanUpdateError;
          }
          loanUpdated = true;

          const { data: updatedPaymentData, error: updatedPaymentError } = await supabase
            .from("loan_payments")
            .update({
              payment_date: input.payment_date,
              amount_paid: amountPaid,
              allocation_principal: simulation.allocationPrincipal,
              allocation_interest: simulation.allocationInterest,
              allocation_fees: simulation.allocationFees,
              schedule_allocation_principal: allocationToDuePrincipal,
              schedule_allocation_interest: allocationToDueInterest,
              schedule_allocation_fees: allocationToDueFees,
              method: simulation.method,
              note: noteText,
            })
            .eq("id", oldPayment.id)
            .select(
              "id, loan_id, schedule_id, payment_date, amount_paid, allocation_principal, allocation_interest, allocation_fees, schedule_allocation_principal, schedule_allocation_interest, schedule_allocation_fees, method, linked_transaction_id, note, loans(name)"
            )
            .single();
          if (updatedPaymentError || !updatedPaymentData) {
            throw updatedPaymentError ?? new Error("Unable to update loan payment.");
          }
          paymentUpdated = true;

          if (oldTransaction) {
            const { error: transactionUpdateError } = await supabase
              .from("transactions")
              .update({
                date: input.payment_date,
                amount: amountPaid,
                notes_enc: transactionNote,
              })
              .eq("id", oldTransaction.id);
            if (transactionUpdateError) {
              throw transactionUpdateError;
            }
            transactionUpdated = true;
          }

          return { data: mapLoanPayment(updatedPaymentData as LoanPaymentRow) };
        } catch (rawError) {
          if (transactionUpdated && oldTransaction) {
            await supabase
              .from("transactions")
              .update({
                date: oldTransaction.date,
                amount: oldTransaction.amount,
                notes_enc: oldTransaction.notes_enc,
              })
              .eq("id", oldTransaction.id);
          }
          if (paymentUpdated) {
            await supabase
              .from("loan_payments")
              .update({
                payment_date: oldPayment.payment_date,
                amount_paid: oldPayment.amount_paid,
                allocation_principal: oldPayment.allocation_principal,
                allocation_interest: oldPayment.allocation_interest,
                allocation_fees: oldPayment.allocation_fees,
                schedule_allocation_principal: oldPayment.schedule_allocation_principal,
                schedule_allocation_interest: oldPayment.schedule_allocation_interest,
                schedule_allocation_fees: oldPayment.schedule_allocation_fees,
                method: oldPayment.method,
                note: oldPayment.note,
              })
              .eq("id", oldPayment.id);
          }
          if (loanUpdated) {
            await supabase
              .from("loans")
              .update({
                principal_outstanding: oldLoan.principal_outstanding,
                status: oldLoan.status,
              })
              .eq("id", oldLoan.id);
          }
          if (scheduleUpdated) {
            await supabase
              .from("loan_schedule")
              .update({
                status: oldSchedule.status,
                paid_date: oldSchedule.paid_date,
                principal_paid: oldSchedule.principal_paid,
                interest_paid: oldSchedule.interest_paid,
                fees_paid: oldSchedule.fees_paid,
                amount_paid: oldSchedule.amount_paid,
              })
              .eq("id", oldSchedule.id);
          }
          return {
            error: {
              message: normalizeApiErrorMessage(
                typeof rawError === "object" && rawError !== null
                  ? (rawError as { message?: string; code?: string })
                  : { message: "Unable to update loan payment." }
              ),
            },
          };
        }
      },
      invalidatesTags: [
        "Loans",
        "LoanSchedule",
        "LoanPayments",
        "Transactions",
        "Accounts",
      ],
    }),
    reverseLoanPayment: builder.mutation<void, ReverseLoanPaymentInput>({
      async queryFn({ id }) {
        const { data: paymentData, error: paymentError } = await supabase
          .from("loan_payments")
          .select(
            "id, loan_id, schedule_id, payment_date, amount_paid, allocation_principal, allocation_interest, allocation_fees, schedule_allocation_principal, schedule_allocation_interest, schedule_allocation_fees, method, linked_transaction_id, note, created_at"
          )
          .eq("id", id)
          .single();
        if (paymentError || !paymentData) {
          return { error: { message: normalizeApiErrorMessage(paymentError) } };
        }

        const payment = paymentData as LoanPaymentRow;
        const { data: loanData, error: loanError } = await supabase
          .from("loans")
          .select("id, principal_original, principal_outstanding, status")
          .eq("id", payment.loan_id)
          .single();
        if (loanError || !loanData) {
          return { error: { message: normalizeApiErrorMessage(loanError) } };
        }

        const oldLoanOutstanding = Number(loanData.principal_outstanding ?? 0);
        const oldLoanStatus = (loanData.status as Loan["status"]) ?? "active";
        const oldLoanOriginal = Number(loanData.principal_original ?? 0);
        const revertedOutstanding = round2(
          Math.min(
            oldLoanOriginal > 0 ? oldLoanOriginal : Number.MAX_SAFE_INTEGER,
            oldLoanOutstanding + Number(payment.allocation_principal ?? 0)
          )
        );
        let revertedLoanStatus: Loan["status"] = oldLoanStatus;
        if (revertedOutstanding <= 0.01) {
          revertedLoanStatus = "closed";
        } else if (oldLoanStatus === "closed") {
          revertedLoanStatus = "active";
        }

        type ScheduleSnapshot = {
          id: string;
          due_date: string;
          status: LoanScheduleStatus;
          paid_date: string | null;
          principal_due: number;
          interest_due: number;
          fees_due: number;
          principal_paid: number;
          interest_paid: number;
          fees_paid: number;
          amount_paid: number;
        };

        let oldSchedule: ScheduleSnapshot | null = null;
        let newSchedule:
          | Pick<
              ScheduleSnapshot,
              | "status"
              | "paid_date"
              | "principal_paid"
              | "interest_paid"
              | "fees_paid"
              | "amount_paid"
            >
          | null = null;

        if (payment.schedule_id) {
          const { data: scheduleData, error: scheduleError } = await supabase
            .from("loan_schedule")
            .select(
              "id, due_date, status, paid_date, principal_due, interest_due, fees_due, principal_paid, interest_paid, fees_paid, amount_paid"
            )
            .eq("id", payment.schedule_id)
            .eq("loan_id", payment.loan_id)
            .single();
          if (scheduleError || !scheduleData) {
            return { error: { message: normalizeApiErrorMessage(scheduleError) } };
          }

          oldSchedule = {
            id: String(scheduleData.id),
            due_date: String(scheduleData.due_date),
            status: (scheduleData.status as LoanScheduleStatus) ?? "due",
            paid_date: (scheduleData.paid_date as string | null) ?? null,
            principal_due: Number(scheduleData.principal_due ?? 0),
            interest_due: Number(scheduleData.interest_due ?? 0),
            fees_due: Number(scheduleData.fees_due ?? 0),
            principal_paid: Number(scheduleData.principal_paid ?? 0),
            interest_paid: Number(scheduleData.interest_paid ?? 0),
            fees_paid: Number(scheduleData.fees_paid ?? 0),
            amount_paid: Number(scheduleData.amount_paid ?? 0),
          };

          const scheduleAppliedPrincipalRaw = Number(
            payment.schedule_allocation_principal ?? 0
          );
          const scheduleAppliedInterestRaw = Number(
            payment.schedule_allocation_interest ?? 0
          );
          const scheduleAppliedFeesRaw = Number(payment.schedule_allocation_fees ?? 0);

          const fallbackAppliedPrincipal = round2(
            Math.min(
              Number(payment.allocation_principal ?? 0),
              oldSchedule.principal_paid
            )
          );
          const fallbackAppliedInterest = round2(
            Math.min(
              Number(payment.allocation_interest ?? 0),
              oldSchedule.interest_paid
            )
          );
          const fallbackAppliedFees = round2(
            Math.min(Number(payment.allocation_fees ?? 0), oldSchedule.fees_paid)
          );

          const scheduleAppliedPrincipal =
            scheduleAppliedPrincipalRaw > 0
              ? round2(Math.min(scheduleAppliedPrincipalRaw, oldSchedule.principal_paid))
              : fallbackAppliedPrincipal;
          const scheduleAppliedInterest =
            scheduleAppliedInterestRaw > 0
              ? round2(Math.min(scheduleAppliedInterestRaw, oldSchedule.interest_paid))
              : fallbackAppliedInterest;
          const scheduleAppliedFees =
            scheduleAppliedFeesRaw > 0
              ? round2(Math.min(scheduleAppliedFeesRaw, oldSchedule.fees_paid))
              : fallbackAppliedFees;
          const scheduleAppliedTotal = round2(
            scheduleAppliedPrincipal + scheduleAppliedInterest + scheduleAppliedFees
          );

          const nextPrincipalPaid = round2(
            Math.max(0, oldSchedule.principal_paid - scheduleAppliedPrincipal)
          );
          const nextInterestPaid = round2(
            Math.max(0, oldSchedule.interest_paid - scheduleAppliedInterest)
          );
          const nextFeesPaid = round2(
            Math.max(0, oldSchedule.fees_paid - scheduleAppliedFees)
          );
          const nextAmountPaid = round2(
            Math.max(0, oldSchedule.amount_paid - scheduleAppliedTotal)
          );

          const remaining = getLoanScheduleRemaining({
            principalDue: oldSchedule.principal_due,
            interestDue: oldSchedule.interest_due,
            feesDue: oldSchedule.fees_due,
            principalPaid: nextPrincipalPaid,
            interestPaid: nextInterestPaid,
            feesPaid: nextFeesPaid,
            amountPaid: nextAmountPaid,
          });
          const nextStatus = getScheduleStatusAfterUpdate({
            dueDate: oldSchedule.due_date,
            remainingTotalDue: remaining.remainingTotalDue,
            paidTotal: nextAmountPaid,
          });

          newSchedule = {
            status: nextStatus,
            paid_date: nextStatus === "paid" ? oldSchedule.paid_date : null,
            principal_paid: nextPrincipalPaid,
            interest_paid: nextInterestPaid,
            fees_paid: nextFeesPaid,
            amount_paid: nextAmountPaid,
          };
        }

        let scheduleUpdated = false;
        let loanUpdated = false;
        let paymentDeleted = false;

        try {
          if (oldSchedule && newSchedule) {
            const { error: scheduleUpdateError } = await supabase
              .from("loan_schedule")
              .update(newSchedule)
              .eq("id", oldSchedule.id);
            if (scheduleUpdateError) {
              throw scheduleUpdateError;
            }
            scheduleUpdated = true;
          }

          const { error: loanUpdateError } = await supabase
            .from("loans")
            .update({
              principal_outstanding: revertedOutstanding,
              status: revertedLoanStatus,
            })
            .eq("id", payment.loan_id);
          if (loanUpdateError) {
            throw loanUpdateError;
          }
          loanUpdated = true;

          const { error: paymentDeleteError } = await supabase
            .from("loan_payments")
            .delete()
            .eq("id", payment.id);
          if (paymentDeleteError) {
            throw paymentDeleteError;
          }
          paymentDeleted = true;

          if (payment.linked_transaction_id) {
            const { error: transactionDeleteError } = await supabase
              .from("transactions")
              .delete()
              .eq("id", payment.linked_transaction_id);
            if (transactionDeleteError) {
              throw transactionDeleteError;
            }
          }

          return { data: undefined };
        } catch (rawError) {
          if (paymentDeleted) {
            await supabase.from("loan_payments").insert({
              id: payment.id,
              loan_id: payment.loan_id,
              schedule_id: payment.schedule_id,
              payment_date: payment.payment_date,
              amount_paid: payment.amount_paid,
              allocation_principal: payment.allocation_principal,
              allocation_interest: payment.allocation_interest,
              allocation_fees: payment.allocation_fees,
              schedule_allocation_principal:
                payment.schedule_allocation_principal ?? 0,
              schedule_allocation_interest:
                payment.schedule_allocation_interest ?? 0,
              schedule_allocation_fees: payment.schedule_allocation_fees ?? 0,
              method: payment.method,
              linked_transaction_id: payment.linked_transaction_id,
              note: payment.note,
              created_at: payment.created_at,
            });
          }
          if (loanUpdated) {
            await supabase
              .from("loans")
              .update({
                principal_outstanding: oldLoanOutstanding,
                status: oldLoanStatus,
              })
              .eq("id", payment.loan_id);
          }
          if (scheduleUpdated && oldSchedule) {
            await supabase
              .from("loan_schedule")
              .update({
                status: oldSchedule.status,
                paid_date: oldSchedule.paid_date,
                principal_paid: oldSchedule.principal_paid,
                interest_paid: oldSchedule.interest_paid,
                fees_paid: oldSchedule.fees_paid,
                amount_paid: oldSchedule.amount_paid,
              })
              .eq("id", oldSchedule.id);
          }

          return {
            error: {
              message: normalizeApiErrorMessage(
                typeof rawError === "object" && rawError !== null
                  ? (rawError as { message?: string; code?: string })
                  : { message: "Unable to reverse loan payment." }
              ),
            },
          };
        }
      },
      invalidatesTags: [
        "Loans",
        "LoanSchedule",
        "LoanPayments",
        "Transactions",
        "Accounts",
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetLoansQuery,
  useAddLoanMutation,
  useUpdateLoanMutation,
  useGetLoanRateRevisionsQuery,
  useAddLoanRateRevisionMutation,
  useSetLoanStatusMutation,
  useDeleteLoanMutation,
  useGetLoanScheduleQuery,
  useGetLoanPaymentsQuery,
  usePostLoanPaymentMutation,
  usePostFlexibleLoanPaymentMutation,
  useUpdateLoanPaymentMutation,
  useReverseLoanPaymentMutation,
} = loansApi;
