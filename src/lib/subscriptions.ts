import dayjs from "dayjs";
import type { Subscription } from "../types/finance";
import { formatCurrency, formatINR } from "./format";
import { getBaseCurrency } from "./moneyConfig";

const ACTIVE_STATUSES = new Set<Subscription["status"]>(["active"]);

const normalizeCurrency = (currency: string) => (currency || "INR").toUpperCase();

export const isForeignCurrencySubscription = (subscription: Subscription) =>
  normalizeCurrency(subscription.currency) !== getBaseCurrency();

export const getSubscriptionPlanningAmount = (subscription: Subscription) =>
  isForeignCurrencySubscription(subscription)
    ? subscription.estimated_base_amount ?? subscription.last_billed_base_amount ?? subscription.amount
    : subscription.amount;

export const getSubscriptionNativeAmountLabel = (subscription: Subscription) =>
  formatCurrency(subscription.amount, normalizeCurrency(subscription.currency));

export const getSubscriptionPlanningAmountLabel = (subscription: Subscription) =>
  isForeignCurrencySubscription(subscription)
    ? `~${formatINR(getSubscriptionPlanningAmount(subscription))}`
    : formatINR(getSubscriptionPlanningAmount(subscription));

export const getSubscriptionAmountSearchTexts = (subscription: Subscription) => {
  const planningAmount = getSubscriptionPlanningAmount(subscription);
  const texts = [
    subscription.amount.toString(),
    planningAmount.toString(),
    getSubscriptionNativeAmountLabel(subscription),
    formatINR(planningAmount),
  ];
  if (isForeignCurrencySubscription(subscription)) {
    texts.push(getSubscriptionPlanningAmountLabel(subscription));
  }
  return texts;
};

export const formatIntervalLabel = (months: number) => {
  if (months === 1) return "Monthly";
  if (months === 12) return "Yearly";
  return `Every ${months} months`;
};

export const calculateSubscriptionTotals = (
  subscriptions: Subscription[],
  month: string
) => {
  const active = subscriptions.filter((sub) => ACTIVE_STATUSES.has(sub.status));
  const monthRef = dayjs(`${month}-01`);
  const dueThisMonth = active
    .filter((sub) => sub.next_due)
    .filter((sub) => dayjs(sub.next_due).isSame(monthRef, "month"))
    .reduce((sum, sub) => sum + getSubscriptionPlanningAmount(sub), 0);
  const annualTotal = active.reduce(
    (sum, sub) =>
      sum +
      getSubscriptionPlanningAmount(sub) * (12 / Math.max(1, sub.interval_months)),
    0
  );
  return { dueThisMonth, annualTotal };
};

export const getUpcomingSubscriptions = (
  subscriptions: Subscription[],
  daysAhead = 30
) => {
  const today = dayjs().startOf("day");
  const cutoff = today.add(daysAhead, "day").endOf("day");
  return subscriptions
    .filter((sub) => sub.status === "active" && sub.next_due)
    .filter((sub) => {
      const due = dayjs(sub.next_due);
      return due.isSame(today) || due.isBefore(cutoff);
    })
    .sort((a, b) => dayjs(a.next_due).diff(dayjs(b.next_due)));
};

export const isSubscriptionOverdue = (subscription: Subscription) =>
  dayjs(subscription.next_due).isBefore(dayjs(), "day");
