import { describe, expect, it } from "vitest";
import {
  areTransactionFiltersEqual,
  createEmptyTransactionFilters,
  filterTransactions,
} from "./transactionFilters";

const sampleTransactions = [
  {
    id: "expense-rent",
    type: "expense" as const,
    amount: 20000,
    category_id: "rent",
    date: "2026-03-01",
    is_recurring: true,
    is_reimbursement: false,
    is_shared: false,
    payment_method_id: "bank-transfer",
    tags: [{ id: "t-home", name: "home" }],
    displayAccount: "BOB Savings 9965",
    displayAccountIds: ["acc-bob"],
    displayCategory: "Bills",
    displayMerchant: "B2 Rent",
    displayNotes: "March rent",
    displayPayment: "Bank Transfer",
    displayTags: "home",
    isGroupedTransfer: false,
  },
  {
    id: "income-trip",
    type: "income" as const,
    amount: 3752,
    category_id: "travel",
    date: "2026-03-19",
    is_recurring: false,
    is_reimbursement: true,
    is_shared: false,
    payment_method_id: "upi",
    tags: [{ id: "t-trip", name: "lonavala-apr-26" }],
    displayAccount: "BOB Savings 9965",
    displayAccountIds: ["acc-bob"],
    displayCategory: "Travel",
    displayMerchant: "Tsuna",
    displayNotes: "Lonavala booking",
    displayPayment: "UPI",
    displayTags: "lonavala-apr-26",
    isGroupedTransfer: false,
  },
  {
    id: "shared-dinner",
    type: "expense" as const,
    amount: 899,
    category_id: null,
    date: "2026-03-12",
    is_recurring: false,
    is_reimbursement: false,
    is_shared: true,
    payment_method_id: null,
    tags: [],
    displayAccount: "One Card 5113",
    displayAccountIds: ["acc-one-card"],
    displayCategory: "Uncategorized",
    displayMerchant: "Dinner Club",
    displayNotes: "Friday dinner",
    displayPayment: "-",
    displayTags: "",
    isGroupedTransfer: false,
  },
  {
    id: "transfer",
    type: "expense" as const,
    amount: 5000,
    category_id: null,
    date: "2026-03-14",
    is_recurring: false,
    is_reimbursement: false,
    is_shared: false,
    payment_method_id: null,
    tags: [],
    displayAccount: "BOB Savings 9965 → Cash Wallet",
    displayAccountIds: ["acc-bob", "acc-cash"],
    displayCategory: "Uncategorized",
    displayMerchant: "Cash transfer",
    displayNotes: "",
    displayPayment: "-",
    displayTags: "",
    isGroupedTransfer: true,
  },
  {
    id: "accountless",
    type: "expense" as const,
    amount: 120,
    category_id: "food",
    date: "2026-03-08",
    is_recurring: false,
    is_reimbursement: false,
    is_shared: false,
    payment_method_id: "cash",
    tags: [],
    displayAccount: "-",
    displayAccountIds: [],
    displayCategory: "Food & Drinks",
    displayMerchant: "Roadside stall",
    displayNotes: "",
    displayPayment: "Cash",
    displayTags: "",
    isGroupedTransfer: false,
  },
];

describe("transactionFilters", () => {
  it("matches multi-token search across text and numeric fields", () => {
    const results = filterTransactions(sampleTransactions, {
      ...createEmptyTransactionFilters(),
      search: "tsuna 3752",
    });

    expect(results.map((item) => item.id)).toEqual(["income-trip"]);
  });

  it("normalizes reversed date and amount ranges", () => {
    const results = filterTransactions(sampleTransactions, {
      ...createEmptyTransactionFilters(),
      dateFrom: "2026-03-20",
      dateTo: "2026-03-10",
      minAmount: "4000",
      maxAmount: "800",
    });

    expect(results.map((item) => item.id)).toEqual([
      "income-trip",
      "shared-dinner",
    ]);
  });

  it("combines type, tags, and flags filters", () => {
    const results = filterTransactions(sampleTransactions, {
      ...createEmptyTransactionFilters(),
      type: "expense",
      tags: ["home"],
      flags: ["recurring"],
    });

    expect(results.map((item) => item.id)).toEqual(["expense-rent"]);
  });

  it("supports uncategorized and no-payment filters", () => {
    const results = filterTransactions(sampleTransactions, {
      ...createEmptyTransactionFilters(),
      categoryId: "uncategorized",
      paymentId: "none",
      flags: ["untagged"],
    });

    expect(results.map((item) => item.id)).toEqual(["shared-dinner", "transfer"]);
  });

  it("supports accountless filters", () => {
    const results = filterTransactions(sampleTransactions, {
      ...createEmptyTransactionFilters(),
      accountId: "none",
    });

    expect(results.map((item) => item.id)).toEqual(["accountless"]);
  });

  it("treats legacy single-tag saved filters as equivalent to the new shape", () => {
    expect(
      areTransactionFiltersEqual(
        { ...createEmptyTransactionFilters(), tag: "home" },
        { ...createEmptyTransactionFilters(), tags: ["home"] }
      )
    ).toBe(true);
  });
});
