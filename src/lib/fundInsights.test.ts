import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Fund } from "../types/finance";
import { buildFundAlerts, buildFundProjections } from "./fundInsights";

describe("fund insights", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects status and required monthly pace", () => {
    const funds: Fund[] = [
      {
        id: "f1",
        name: "Car fund",
        type: "car",
        target_amount: 1000,
        current_amount: 200,
        monthly_contribution: 200,
        target_date: "2024-06-15",
        notes: null,
        is_archived: false,
      },
      {
        id: "f2",
        name: "Land fund",
        type: "land",
        target_amount: 1000,
        current_amount: 200,
        monthly_contribution: 100,
        target_date: "2024-03-15",
        notes: null,
        is_archived: false,
      },
      {
        id: "f3",
        name: "Emergency fund",
        type: "emergency",
        target_amount: 2000,
        current_amount: 400,
        monthly_contribution: null,
        target_date: null,
        notes: null,
        is_archived: false,
      },
      {
        id: "f4",
        name: "Goal met",
        type: "goal",
        target_amount: 1500,
        current_amount: 1500,
        monthly_contribution: 100,
        target_date: "2024-02-15",
        notes: null,
        is_archived: false,
      },
    ];

    const projections = buildFundProjections(funds);
    const car = projections.find((item) => item.id === "f1");
    const land = projections.find((item) => item.id === "f2");
    const emergency = projections.find((item) => item.id === "f3");
    const goal = projections.find((item) => item.id === "f4");

    expect(car?.status).toBe("On track");
    expect(car?.projectedDateLabel).toBe("May 2024");
    expect(car?.requiredMonthly).toBe(160);

    expect(land?.status).toBe("Behind schedule");
    expect(land?.projectedDateLabel).toBe("Sep 2024");
    expect(land?.requiredMonthly).toBe(400);

    expect(emergency?.status).toBe("No monthly plan");
    expect(emergency?.projectedDateLabel).toBe("Set monthly plan");

    expect(goal?.status).toBe("Goal met");
    expect(goal?.projectedDateLabel).toBe("Goal met");
  });

  it("builds alerts for milestones and pacing", () => {
    const projections = [
      {
        id: "a",
        name: "Behind",
        progress: 40,
        remaining: 600,
        monthlyContribution: 100,
        projectedDateLabel: "Jun 2024",
        targetDateLabel: "Apr 2024",
        requiredMonthly: 200,
        status: "Behind schedule" as const,
        nextMilestoneLabel: "50% (₹200 to go)",
        currentAmount: 400,
        targetAmount: 1000,
      },
      {
        id: "b",
        name: "No plan",
        progress: 10,
        remaining: 900,
        monthlyContribution: null,
        projectedDateLabel: "Set monthly plan",
        targetDateLabel: null,
        requiredMonthly: null,
        status: "No monthly plan" as const,
        nextMilestoneLabel: "25% (₹150 to go)",
        currentAmount: 100,
        targetAmount: 1000,
      },
      {
        id: "c",
        name: "Met",
        progress: 100,
        remaining: 0,
        monthlyContribution: 200,
        projectedDateLabel: "Goal met",
        targetDateLabel: "May 2024",
        requiredMonthly: null,
        status: "Goal met" as const,
        nextMilestoneLabel: "100% (Goal met)",
        currentAmount: 1000,
        targetAmount: 1000,
      },
      {
        id: "d",
        name: "Halfway",
        progress: 50,
        remaining: 500,
        monthlyContribution: 200,
        projectedDateLabel: "Dec 2024",
        targetDateLabel: "Dec 2024",
        requiredMonthly: null,
        status: "On track" as const,
        nextMilestoneLabel: "75% (₹250 to go)",
        currentAmount: 500,
        targetAmount: 1000,
      },
    ];

    const alerts = buildFundAlerts(projections);
    const titles = alerts.map((alert) => alert.title);

    expect(titles).toContain("Behind is behind schedule");
    expect(titles).toContain("No plan needs a monthly plan");
    expect(titles).toContain("Met goal met");
    expect(titles).toContain("Halfway hit 50%");
  });
});
