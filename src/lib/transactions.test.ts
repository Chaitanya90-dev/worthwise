import { describe, expect, it } from "vitest";
import type { Transaction } from "../types/finance";
import {
  getDisplayCategoryId,
  getIncomeDelta,
  getNetExpenseCategoryKey,
  getNetExpenseDelta,
} from "./transactions";

const baseTx: Transaction = {
  id: "t1",
  type: "expense",
  date: "2024-08-10",
  amount: 100,
  category_id: "c1",
  payment_method_id: null,
  is_recurring: false,
};

describe("transaction helpers", () => {
  it("uses reimbursement category for display", () => {
    const tx: Transaction = {
      ...baseTx,
      type: "income",
      is_reimbursement: true,
      reimbursement_category_id: "c2",
      category_id: "c3",
    };
    expect(getDisplayCategoryId(tx)).toBe("c2");
  });

  it("nets reimbursements against expense totals", () => {
    const expense: Transaction = { ...baseTx, amount: 250 };
    const reimbursement: Transaction = {
      ...baseTx,
      id: "t2",
      type: "income",
      amount: 100,
      is_reimbursement: true,
      reimbursement_category_id: "c1",
    };
    expect(getNetExpenseDelta(expense)).toBe(250);
    expect(getNetExpenseDelta(reimbursement)).toBe(-100);
    expect(getNetExpenseCategoryKey(reimbursement)).toBe("c1");
  });

  it("excludes transfers and reimbursements from income totals", () => {
    const income: Transaction = { ...baseTx, type: "income", amount: 400 };
    const transferIncome: Transaction = {
      ...baseTx,
      id: "t2",
      type: "income",
      amount: 200,
      is_transfer: true,
    };
    const reimbursement: Transaction = {
      ...baseTx,
      id: "t3",
      type: "income",
      amount: 120,
      is_reimbursement: true,
      reimbursement_category_id: "c1",
    };
    expect(getIncomeDelta(income)).toBe(400);
    expect(getIncomeDelta(transferIncome)).toBe(0);
    expect(getIncomeDelta(reimbursement)).toBe(0);
  });
});
