import { describe, expect, it } from "vitest";
import type { Transaction } from "../types/finance";
import {
  buildCategoryRows,
  buildTagOptions,
  calculateCashflowMetrics,
  filterTransactions,
} from "./cashflow";

describe("cashflow calculations", () => {
  it("filters transactions by payment method and tag", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        type: "expense",
        date: "2024-08-02",
        amount: 120,
        category_id: "c1",
        payment_method_id: "p1",
        is_recurring: false,
        tags: [{ id: "t-food", name: "Food" }],
      },
      {
        id: "t2",
        type: "expense",
        date: "2024-08-03",
        amount: 80,
        category_id: "c2",
        payment_method_id: "p2",
        is_recurring: false,
        tags: [{ id: "t-travel", name: "Travel" }],
      },
      {
        id: "t3",
        type: "income",
        date: "2024-08-04",
        amount: 500,
        category_id: "c3",
        payment_method_id: "p1",
        is_recurring: false,
      },
    ];

    expect(filterTransactions(transactions, "p1", "")).toHaveLength(2);
    expect(filterTransactions(transactions, "", "t-travel")).toHaveLength(1);
    expect(filterTransactions(transactions, "p1", "t-food")).toHaveLength(1);
    expect(filterTransactions(transactions, "p2", "t-food")).toHaveLength(0);
  });

  it("builds tag options from transactions", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        type: "expense",
        date: "2024-08-02",
        amount: 120,
        category_id: "c1",
        payment_method_id: "p1",
        is_recurring: false,
        tags: [
          { id: "t-food", name: "Food" },
          { id: "t-groceries", name: "Groceries" },
        ],
      },
      {
        id: "t2",
        type: "expense",
        date: "2024-08-03",
        amount: 80,
        category_id: "c2",
        payment_method_id: "p2",
        is_recurring: false,
        tags: [{ id: "t-food", name: "Food" }],
      },
    ];

    const options = buildTagOptions(transactions);
    expect(options).toHaveLength(2);
    expect(options.find((tag) => tag.id === "t-food")?.name).toBe("Food");
  });

  it("calculates weekly rollups and category totals", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        type: "income",
        date: "2024-08-02",
        amount: 1000,
        category_id: "c-income",
        payment_method_id: null,
        is_recurring: false,
      },
      {
        id: "t2",
        type: "expense",
        date: "2024-08-08",
        amount: 200,
        category_id: "c-food",
        payment_method_id: null,
        is_recurring: false,
      },
      {
        id: "t3",
        type: "expense",
        date: "2024-08-15",
        amount: 50,
        category_id: null,
        payment_method_id: null,
        is_recurring: false,
      },
      {
        id: "t4",
        type: "income",
        date: "2024-08-29",
        amount: 300,
        category_id: "c-income",
        payment_method_id: null,
        is_recurring: false,
      },
    ];

    const categoryMap = new Map([
      ["c-income", "Salary"],
      ["c-food", "Food"],
    ]);

    const metrics = calculateCashflowMetrics({
      transactions,
      month: "2024-08",
      categoryMap,
    });

    expect(metrics.totalIncome).toBe(1300);
    expect(metrics.totalExpense).toBe(250);
    expect(metrics.net).toBe(1050);
    expect(metrics.incomeCount).toBe(2);
    expect(metrics.expenseCount).toBe(2);
    expect(metrics.weeklyData).toHaveLength(5);
    expect(metrics.weeklyData[0].income).toBe(1000);
    expect(metrics.weeklyData[1].expense).toBe(200);
    expect(metrics.weeklyData[2].expense).toBe(50);
    expect(metrics.weeklyData[4].income).toBe(300);
    expect(metrics.topExpenseCategories[0].name).toBe("Food");
    expect(metrics.topIncomeCategories[0].name).toBe("Salary");
  });

  it("builds category rows with shares", () => {
    const rows = buildCategoryRows(
      [
        { id: "c1", name: "Food", value: 80 },
        { id: "c2", name: "Travel", value: 20 },
      ],
      100
    );

    expect(rows[0]).toEqual({
      id: "c1",
      category: "Food",
      amount: 80,
      share: 80,
    });
  });
});
