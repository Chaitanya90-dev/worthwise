import dayjs from "dayjs";
import type { Subscription, Transaction } from "../types/finance";
import { getSubscriptionPlanningAmount } from "./subscriptions";
import { getIncomeDelta } from "./transactions";

export type ForecastDay = {
  date: string;
  balance: number;
  baselineSpend: number;
  recurringDelta: number;
  subscriptionDelta: number;
  netChange: number;
};

export type ForecastResult = {
  startBalance: number;
  endBalance: number;
  minBalance: number;
  minDate: string | null;
  firstNegativeDate: string | null;
  daily: ForecastDay[];
};

type ForecastInput = {
  startBalance: number;
  avgDailySpend: number;
  recurringTransactions: Transaction[];
  subscriptions: Subscription[];
  days: number;
  startDate?: dayjs.Dayjs;
};

const buildRecurringEvents = (
  recurringTransactions: Transaction[],
  start: dayjs.Dayjs,
  end: dayjs.Dayjs
) => {
  const events = new Map<string, number>();
  const startMonth = start.startOf("month");
  const endMonth = end.startOf("month");

  recurringTransactions.forEach((tx) => {
    if (!tx.is_recurring || tx.is_transfer) {
      return;
    }
    if (tx.type === "income" && tx.is_reimbursement) {
      return;
    }
    const delta = tx.type === "income" ? getIncomeDelta(tx) : -tx.amount;
    if (!delta) {
      return;
    }
    const anchor = dayjs(tx.date);
    if (!anchor.isValid()) {
      return;
    }
    const anchorMonth = anchor.startOf("month");
    for (
      let month = startMonth;
      month.isBefore(endMonth) || month.isSame(endMonth, "month");
      month = month.add(1, "month")
    ) {
      if (month.isBefore(anchorMonth, "month")) {
        continue;
      }
      const dueDay = Math.min(anchor.date(), month.daysInMonth());
      const dueDate = month.date(dueDay);
      if (dueDate.isBefore(start, "day") || dueDate.isAfter(end, "day")) {
        continue;
      }
      const key = dueDate.format("YYYY-MM-DD");
      events.set(key, (events.get(key) ?? 0) + delta);
    }
  });

  return events;
};

const buildSubscriptionEvents = (
  subscriptions: Subscription[],
  start: dayjs.Dayjs,
  end: dayjs.Dayjs
) => {
  const events = new Map<string, number>();
  subscriptions
    .filter((sub) => sub.status === "active" && sub.next_due)
    .forEach((sub) => {
      let due = dayjs(sub.next_due);
      if (!due.isValid()) {
        return;
      }
      const interval = Math.max(1, sub.interval_months);
      while (due.isBefore(start, "day")) {
        due = due.add(interval, "month");
      }
      while (due.isBefore(end, "day") || due.isSame(end, "day")) {
        const key = due.format("YYYY-MM-DD");
        events.set(key, (events.get(key) ?? 0) - getSubscriptionPlanningAmount(sub));
        due = due.add(interval, "month");
      }
    });
  return events;
};

export const buildCashRunwayForecast = ({
  startBalance,
  avgDailySpend,
  recurringTransactions,
  subscriptions,
  days,
  startDate,
}: ForecastInput): ForecastResult => {
  const start = (startDate ?? dayjs()).startOf("day");
  const end = start.add(days - 1, "day").endOf("day");
  const recurringEvents = buildRecurringEvents(recurringTransactions, start, end);
  const subscriptionEvents = buildSubscriptionEvents(subscriptions, start, end);

  const daily: ForecastDay[] = [];
  let balance = startBalance;
  let minBalance = startBalance;
  let minDate: string | null = start.format("YYYY-MM-DD");
  let firstNegativeDate: string | null = null;

  for (let i = 0; i < days; i += 1) {
    const date = start.add(i, "day");
    const key = date.format("YYYY-MM-DD");
    const baselineSpend = avgDailySpend > 0 ? avgDailySpend : 0;
    const recurringDelta = recurringEvents.get(key) ?? 0;
    const subscriptionDelta = subscriptionEvents.get(key) ?? 0;
    const netChange = recurringDelta + subscriptionDelta - baselineSpend;
    balance += netChange;
    if (balance < minBalance) {
      minBalance = balance;
      minDate = key;
    }
    if (balance < 0 && !firstNegativeDate) {
      firstNegativeDate = key;
    }
    daily.push({
      date: key,
      balance,
      baselineSpend,
      recurringDelta,
      subscriptionDelta,
      netChange,
    });
  }

  return {
    startBalance,
    endBalance: balance,
    minBalance,
    minDate,
    firstNegativeDate,
    daily,
  };
};
