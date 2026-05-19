import { describe, expect, it } from "vitest";
import type { Budget, Category, Transaction } from "../types/finance";
import {
  buildBudgetWarnings,
  buildCategoryMap,
  buildDailyData,
  buildPieData,
  calculateDashboardMetrics,
} from "./dashboard";

describe("dashboard calculations", () => {
  it("calculates totals, budgets, and daily rollups", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        type: "expense",
        date: "2024-08-05",
        amount: 100,
        category_id: "c1",
        payment_method_id: null,
        is_recurring: false,
      },
      {
        id: "t2",
        type: "income",
        date: "2024-08-05",
        amount: 500,
        category_id: "c2",
        payment_method_id: null,
        is_recurring: false,
      },
      {
        id: "t3",
        type: "expense",
        date: "2024-08-06",
        amount: 50,
        category_id: null,
        payment_method_id: null,
        is_recurring: false,
      },
    ];

    const budgets: Budget[] = [
      { id: "b1", month: "2024-08", category_id: "c1", amount: 300, rollover_enabled: false },
      { id: "b2", month: "2024-08", category_id: null, amount: 1000, rollover_enabled: false },
    ];

    const metrics = calculateDashboardMetrics(transactions, budgets);

    expect(metrics.totalSpent).toBe(150);
    expect(metrics.totalBudget).toBe(1000);
    expect(metrics.categoryTotals.get("c1")).toBe(100);
    expect(metrics.categoryTotals.has("c2")).toBe(false);
    expect(metrics.dailyTotals.get("2024-08-05")).toBe(100);
    expect(metrics.dailyTotals.get("2024-08-06")).toBe(50);
    expect(metrics.categoryBudgets.get("c1")).toBe(300);
    expect(metrics.overallBudget).toBe(1000);
  });

  it("sums category budgets when no overall budget exists", () => {
    const budgets: Budget[] = [
      { id: "b1", month: "2024-08", category_id: "c1", amount: 200, rollover_enabled: false },
      { id: "b2", month: "2024-08", category_id: "c2", amount: 300, rollover_enabled: false },
    ];

    const metrics = calculateDashboardMetrics([], budgets);

    expect(metrics.totalBudget).toBe(500);
  });

  it("builds warnings for overall and category budgets", () => {
    const categoryMap = new Map([
      ["c1", "Food"],
      ["c2", "Travel"],
    ]);
    const categoryBudgets = new Map([
      ["c1", 200],
      ["c2", 100],
    ]);
    const categoryTotals = new Map([
      ["c1", 180],
      ["c2", 50],
    ]);

    const warnings = buildBudgetWarnings({
      overallBudget: 500,
      totalSpent: 230,
      categoryBudgets,
      categoryTotals,
      categoryMap,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].label).toBe("Food");
    expect(warnings[0].ratio).toBeCloseTo(0.9);

    const overallWarnings = buildBudgetWarnings({
      overallBudget: 200,
      totalSpent: 180,
      categoryBudgets: new Map(),
      categoryTotals: new Map(),
      categoryMap: new Map(),
    });

    expect(overallWarnings).toHaveLength(1);
    expect(overallWarnings[0].label).toBe("Overall budget");
  });

  it("builds pie and daily series data", () => {
    const categoryTotals = new Map([
      ["c1", 120],
      ["c2", 80],
    ]);
    const categoryMap = new Map([["c1", "Food"]]);

    const pieData = buildPieData(categoryTotals, categoryMap);
    expect(pieData).toEqual([
      { name: "Food", value: 120 },
      { name: "Uncategorized", value: 80 },
    ]);

    const dailyTotals = new Map([
      ["2024-08-01", 120],
      ["2024-08-02", 80],
    ]);
    const dailyData = buildDailyData(dailyTotals);
    expect(dailyData).toEqual([
      { day: "01 Aug", value: 120 },
      { day: "02 Aug", value: 80 },
    ]);
  });

  it("builds a category map from category definitions", () => {
    const categories: Category[] = [
      {
        id: "c1",
        name: "Food",
        parent_id: null,
        type: "expense",
      },
      {
        id: "c2",
        name: "Salary",
        parent_id: null,
        type: "income",
      },
    ];

    const categoryMap = buildCategoryMap(categories);
    expect(categoryMap.get("c1")).toBe("Food");
    expect(categoryMap.get("c2")).toBe("Salary");
  });
});
