import dayjs from "dayjs";
import type { Fund } from "../types/finance";
import { formatINR } from "./format";

export type FundProjection = {
  id: string;
  name: string;
  progress: number;
  remaining: number;
  monthlyContribution: number | null;
  projectedDateLabel: string;
  targetDateLabel: string | null;
  requiredMonthly: number | null;
  status: "On track" | "Behind schedule" | "No monthly plan" | "Goal met";
  nextMilestoneLabel: string | null;
  currentAmount: number;
  targetAmount: number;
};

export type FundAlert = {
  id: string;
  title: string;
  detail: string;
  tone: "red" | "yellow" | "green" | "blue";
  severity: number;
};

const MILESTONES = [25, 50, 75, 100];

const formatMonth = (value: string) => dayjs(value).format("MMM YYYY");

const buildNextMilestoneLabel = (
  targetAmount: number,
  currentAmount: number,
  progress: number
) => {
  if (targetAmount <= 0) {
    return null;
  }
  const nextMilestone = MILESTONES.find((milestone) => progress < milestone) ?? 100;
  const nextAmount = Math.max(0, (targetAmount * nextMilestone) / 100 - currentAmount);
  if (nextAmount <= 0 && progress >= 100) {
    return "100% (Goal met)";
  }
  return `${nextMilestone}% (${formatINR(nextAmount)} to go)`;
};

export const buildFundProjections = (funds: Fund[]) => {
  const now = dayjs();

  return funds.map((fund) => {
    const targetAmount = fund.target_amount ?? 0;
    const currentAmount = fund.current_amount ?? 0;
    const progressRaw =
      targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const progress = Math.max(0, Math.min(100, Math.round(progressRaw)));
    const remaining = Math.max(0, targetAmount - currentAmount);
    const monthlyContribution =
      fund.monthly_contribution && fund.monthly_contribution > 0
        ? fund.monthly_contribution
        : null;
    const targetDateLabel = fund.target_date ? formatMonth(fund.target_date) : null;
    const targetDate = fund.target_date ? dayjs(fund.target_date) : null;
    const monthsToTarget = targetDate
      ? Math.ceil(targetDate.diff(now, "month", true))
      : null;
    const requiredMonthly =
      targetDateLabel && remaining > 0
        ? Math.ceil(remaining / Math.max(1, monthsToTarget ?? 1))
        : null;

    let status: FundProjection["status"] = "No monthly plan";
    let projectedDateLabel = "Set monthly plan";

    if (remaining <= 0) {
      status = "Goal met";
      projectedDateLabel = "Goal met";
    } else if (monthlyContribution) {
      const monthsNeeded = Math.ceil(remaining / monthlyContribution);
      projectedDateLabel = dayjs().add(monthsNeeded, "month").format("MMM YYYY");
      if (targetDate && targetDate.isBefore(now, "month")) {
        status = "Behind schedule";
      } else if (targetDate && dayjs().add(monthsNeeded, "month").isAfter(targetDate, "month")) {
        status = "Behind schedule";
      } else {
        status = "On track";
      }
    } else if (targetDate && targetDate.isBefore(now, "month")) {
      status = "Behind schedule";
      projectedDateLabel = "Past target date";
    }

    return {
      id: fund.id,
      name: fund.name,
      progress,
      remaining,
      monthlyContribution,
      projectedDateLabel,
      targetDateLabel,
      requiredMonthly,
      status,
      nextMilestoneLabel: buildNextMilestoneLabel(
        targetAmount,
        currentAmount,
        progress
      ),
      currentAmount,
      targetAmount,
    };
  });
};

export const buildFundAlerts = (projections: FundProjection[]) => {
  const alerts: FundAlert[] = [];

  projections.forEach((projection) => {
    if (projection.remaining > 0 && projection.status === "Behind schedule") {
      const detail = projection.targetDateLabel
        ? `Projected ${projection.projectedDateLabel}, target ${projection.targetDateLabel}.`
        : "Projection is behind the target pace.";
      alerts.push({
        id: `${projection.id}-behind`,
        title: `${projection.name} is behind schedule`,
        detail,
        tone: "red",
        severity: 1,
      });
    }

    if (projection.remaining > 0 && projection.status === "No monthly plan") {
      const detail = projection.targetDateLabel
        ? `Set a monthly plan to hit ${projection.targetDateLabel}.`
        : "Add a monthly contribution to unlock projections.";
      alerts.push({
        id: `${projection.id}-noplan`,
        title: `${projection.name} needs a monthly plan`,
        detail,
        tone: "yellow",
        severity: 2,
      });
    }

    if (projection.progress >= 100) {
      alerts.push({
        id: `${projection.id}-goal`,
        title: `${projection.name} goal met`,
        detail: `${formatINR(projection.currentAmount)} saved of ${formatINR(
          projection.targetAmount
        )}.`,
        tone: "green",
        severity: 3,
      });
      return;
    }

    if (projection.progress >= 75) {
      alerts.push({
        id: `${projection.id}-milestone-75`,
        title: `${projection.name} hit 75%`,
        detail: projection.nextMilestoneLabel
          ? `Next milestone: ${projection.nextMilestoneLabel}.`
          : "Next milestone ahead.",
        tone: "blue",
        severity: 4,
      });
      return;
    }

    if (projection.progress >= 50) {
      alerts.push({
        id: `${projection.id}-milestone-50`,
        title: `${projection.name} hit 50%`,
        detail: projection.nextMilestoneLabel
          ? `Next milestone: ${projection.nextMilestoneLabel}.`
          : "Next milestone ahead.",
        tone: "blue",
        severity: 5,
      });
      return;
    }

    if (projection.progress >= 25) {
      alerts.push({
        id: `${projection.id}-milestone-25`,
        title: `${projection.name} hit 25%`,
        detail: projection.nextMilestoneLabel
          ? `Next milestone: ${projection.nextMilestoneLabel}.`
          : "Keep going to the next milestone.",
        tone: "blue",
        severity: 6,
      });
    }
  });

  return alerts.sort((a, b) => a.severity - b.severity);
};
