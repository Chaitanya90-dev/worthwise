import { describe, expect, it } from "vitest";
import type {
  Account,
  Category,
  PaymentMethod,
  TransactionRule,
} from "../types/finance";
import {
  buildBulkEntryRows,
  createBulkEntryRow,
  getNextBulkEntryDate,
  resolveBulkEntryRow,
  type BulkEntryDefaults,
} from "./bulkEntry";

const categories: Category[] = [
  { id: "cat-food", name: "Food", parent_id: null, type: "expense" },
  { id: "cat-travel", name: "Travel", parent_id: null, type: "expense" },
];

const paymentMethods: PaymentMethod[] = [
  { id: "pm-upi", name: "UPI" },
  { id: "pm-card", name: "Credit Card" },
];

const accounts: Account[] = [
  {
    id: "acct-bob",
    name: "Bank of Baroda Savings Account",
    type: "bank",
    current_balance: 0,
    currency: "INR",
  },
  {
    id: "acct-card",
    name: "ICICI Amazon Pay Credit Card",
    type: "card",
    current_balance: 0,
    currency: "INR",
  },
];

const rules: TransactionRule[] = [
  {
    id: "rule-food",
    name: "Cafe to food",
    match_text: "cafe",
    match_type: "contains",
    transaction_type: "expense",
    category_id: "cat-food",
    account_id: null,
    payment_method_id: null,
    tag_names: ["outside"],
    is_active: true,
    priority: 10,
  },
  {
    id: "rule-uber",
    name: "Uber defaults",
    match_text: "uber",
    match_type: "contains",
    transaction_type: "expense",
    category_id: "cat-travel",
    account_id: "acct-bob",
    payment_method_id: "pm-upi",
    tag_names: [],
    is_active: true,
    priority: 20,
  },
];

const defaults: BulkEntryDefaults = {
  type: "expense",
  date: "2026-03-14",
  autoIncrementDate: true,
  category_id: "cat-travel",
  payment_method_id: "pm-upi",
  account_id: "acct-bob",
};

describe("bulkEntry helpers", () => {
  it("builds the requested number of starter rows", () => {
    const rows = buildBulkEntryRows("2026-03-14", 3);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.date === "2026-03-14")).toBe(true);
  });

  it("increments the date when auto increment is enabled", () => {
    expect(
      getNextBulkEntryDate({
        baseDate: "2026-03-14",
        autoIncrementDate: true,
      }),
    ).toBe("2026-03-15");
    expect(
      getNextBulkEntryDate({
        baseDate: "2026-03-14",
        autoIncrementDate: false,
      }),
    ).toBe("2026-03-14");
  });

  it("uses rule category and tags before fallback defaults", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "30",
        merchant: "VC Cafe",
        notes: "varan vati",
      }),
      defaults,
      categories,
      paymentMethods,
      accounts,
      rules,
    });

    expect(resolved.category_id).toBe("cat-food");
    expect(resolved.categoryLabel).toBe("Food");
    expect(resolved.tags).toEqual(["outside"]);
    expect(resolved.account_id).toBe("acct-bob");
    expect(resolved.payment_method_id).toBe("pm-upi");
  });

  it("falls back to defaults when no rule matches", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "250",
        merchant: "Uber",
      }),
      defaults,
      categories,
      paymentMethods,
      accounts,
      rules,
    });

    expect(resolved.category_id).toBe("cat-travel");
    expect(resolved.categoryLabel).toBe("Travel");
  });

  it("applies account and payment from matched rules when row is unset", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "140",
        merchant: "Uber India",
      }),
      defaults: {
        ...defaults,
        account_id: "",
        payment_method_id: "",
      },
      categories,
      paymentMethods,
      accounts,
      rules,
    });

    expect(resolved.account_id).toBe("acct-bob");
    expect(resolved.payment_method_id).toBe("pm-upi");
  });

  it("lets a row override category, account, and payment", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "250",
        merchant: "Uber",
        category_id: "cat-food",
        account_id: "acct-card",
        payment_method_id: "pm-card",
      }),
      defaults,
      categories,
      paymentMethods,
      accounts,
      rules,
    });

    expect(resolved.category_id).toBe("cat-food");
    expect(resolved.account_id).toBe("acct-card");
    expect(resolved.payment_method_id).toBe("pm-card");
  });

  it("picks a card payment when a row overrides to a card account", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "250",
        merchant: "Amazon",
        account_id: "acct-card",
      }),
      defaults,
      categories,
      paymentMethods,
      accounts,
      rules,
    });

    expect(resolved.account_id).toBe("acct-card");
    expect(resolved.payment_method_id).toBe("pm-card");
    expect(resolved.errors).toEqual([]);
  });

  it("defaults card accounts to a card payment method", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "599",
        merchant: "Amazon",
      }),
      defaults: {
        ...defaults,
        account_id: "acct-card",
        payment_method_id: "",
      },
      categories,
      paymentMethods,
      accounts,
      rules: [],
    });

    expect(resolved.payment_method_id).toBe("pm-card");
    expect(resolved.errors).toEqual([]);
  });

  it("surfaces inline validation errors for incomplete rows", () => {
    const resolved = resolveBulkEntryRow({
      row: createBulkEntryRow("2026-03-14", {
        amount: "",
        merchant: "VC Cafe",
      }),
      defaults: {
        ...defaults,
        account_id: "",
      },
      categories,
      paymentMethods,
      accounts,
      rules,
    });

    expect(resolved.errors).toContain("Enter an amount greater than 0.");
    expect(resolved.errors).toContain("Choose an account.");
  });
});
