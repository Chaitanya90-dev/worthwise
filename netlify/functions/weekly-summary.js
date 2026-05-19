import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const CASHCOVE_APP_URL = process.env.CASHCOVE_APP_URL || "";
const FALLBACK_CURRENCY = process.env.CASHCOVE_CURRENCY || "USD";
const FALLBACK_LOCALE = process.env.CASHCOVE_LOCALE || "en-US";

const weekdayMap = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const normalizeCurrency = (value) =>
  String(value || FALLBACK_CURRENCY).trim().toUpperCase();

const sanitizeExchangeRates = (rates, baseCurrency) => {
  const sanitized = {};
  Object.entries(rates ?? {}).forEach(([currency, rate]) => {
    const normalizedCurrency = normalizeCurrency(currency);
    const numericRate = Number(rate);
    if (
      normalizedCurrency !== baseCurrency &&
      Number.isFinite(numericRate) &&
      numericRate > 0
    ) {
      sanitized[normalizedCurrency] = numericRate;
    }
  });
  return sanitized;
};

const getRateToBaseCurrency = (currency, baseCurrency, exchangeRates) => {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === baseCurrency) {
    return 1;
  }
  return exchangeRates[normalizedCurrency] ?? null;
};

const convertAmount = ({
  amount,
  fromCurrency,
  toCurrency,
  baseCurrency,
  exchangeRates,
}) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  const normalizedFrom = normalizeCurrency(fromCurrency);
  const normalizedTo = normalizeCurrency(toCurrency);
  if (normalizedFrom === normalizedTo) {
    return numericAmount;
  }

  const fromRate = getRateToBaseCurrency(
    normalizedFrom,
    baseCurrency,
    exchangeRates,
  );
  const toRate = getRateToBaseCurrency(normalizedTo, baseCurrency, exchangeRates);

  if (!fromRate || !toRate) {
    return null;
  }

  const amountInBase = numericAmount * fromRate;
  return amountInBase / toRate;
};

const buildMoneyFormatter = ({ locale, currency }) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  });

const formatRangeLabel = ({ startDate, endDate, locale, timeZone }) => {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${dateFormatter.format(new Date(`${startDate}T00:00:00Z`))} to ${dateFormatter.format(
    new Date(`${endDate}T00:00:00Z`),
  )}`;
};

const getZonedParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const weekday = weekdayMap[parts.weekday] ?? 0;

  return { year, month, day, hour, minute, weekday };
};

const parseTime = (value) => {
  const [hourStr, minuteStr] = (value || "").split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return { hour: 8, minute: 0 };
  }
  return { hour, minute };
};

const buildDateKey = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getLocalDateString = (date, timeZone) => {
  const parts = getZonedParts(date, timeZone);
  return buildDateKey(parts.year, parts.month, parts.day);
};

const computeRange = (nowParts) => {
  const localMidnightUtc = new Date(
    Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day)
  );
  const end = localMidnightUtc;
  const start = new Date(localMidnightUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
  const endPlusWeek = new Date(
    localMidnightUtc.getTime() + 7 * 24 * 60 * 60 * 1000
  );

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    dueEndDate: endPlusWeek.toISOString().slice(0, 10),
  };
};

const computeMonthRange = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    monthKey: buildDateKey(year, month, 1).slice(0, 7),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const getNetExpenseDelta = (tx) => {
  if (tx.is_transfer) {
    return 0;
  }
  if (tx.type === "expense") {
    return tx.amount;
  }
  if (tx.type === "income" && tx.is_reimbursement) {
    return -tx.amount;
  }
  return 0;
};

const getIncomeDelta = (tx) => {
  if (tx.is_transfer || tx.type !== "income" || tx.is_reimbursement) {
    return 0;
  }
  return tx.amount;
};

const buildEmailHtml = ({
  userName,
  rangeLabel,
  totalSpent,
  totalIncome,
  net,
  topCategories,
  budgetWarnings,
  subscriptions,
  formatCurrency,
  displayCurrency,
}) => {
  const topCategoriesHtml =
    topCategories.length === 0
      ? "<p>No spending categories yet this week.</p>"
      : `<ul>${topCategories
          .map((item) => `<li>${item.name}: ${formatCurrency(item.amount)}</li>`)
          .join("")}</ul>`;

  const warningsHtml =
    budgetWarnings.length === 0
      ? "<p>No budgets near their limits.</p>"
      : `<ul>${budgetWarnings
          .map(
            (item) =>
              `<li>${item.label}: ${Math.round(item.ratio * 100)}% used (${formatCurrency(
                item.spent
              )} of ${formatCurrency(item.budget)})</li>`
          )
          .join("")}</ul>`;

  const subsHtml =
    subscriptions.length === 0
      ? "<p>No upcoming bills in the next 7 days.</p>"
      : `<ul>${subscriptions
          .map(
            (sub) =>
              `<li>${sub.name} on ${sub.next_due}: ${formatCurrency(sub.amount)}</li>`
          )
          .join("")}</ul>`;

  const appLink = CASHCOVE_APP_URL
    ? `<p><a href="${CASHCOVE_APP_URL}">Open CashCove</a></p>`
    : "";

  return `
    <div style="font-family: Inter, system-ui, Arial, sans-serif; color: #1f2933; line-height: 1.5;">
      <h2>CashCove weekly summary</h2>
      <p>Hello${userName ? ` ${userName}` : ""}! Here is your summary for ${rangeLabel}.</p>
      <h3>Weekly totals</h3>
      <p>Spent: ${formatCurrency(totalSpent)} | Income: ${formatCurrency(
    totalIncome
  )} | Net: ${formatCurrency(net)}</p>
      <h3>Top categories</h3>
      ${topCategoriesHtml}
      <h3>Budget status</h3>
      ${warningsHtml}
      <h3>Upcoming bills</h3>
      ${subsHtml}
      ${appLink}
      <p style="font-size: 12px; color: #6b7280;">Display currency: ${displayCurrency}</p>
      <p style="font-size: 12px; color: #6b7280;">You can update this schedule in Settings.</p>
    </div>
  `;
};

const sendEmail = async (to, subject, html) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend error: ${detail}`);
  }
};

const runWeeklySummary = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: "Missing Supabase credentials" };
  }
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return { statusCode: 500, body: "Missing email credentials" };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: preferences, error: prefError } = await supabase
    .from("user_preferences")
    .select(
      "user_id, weekly_summary_enabled, weekly_summary_day, weekly_summary_time, weekly_summary_timezone, weekly_summary_last_sent_at, locale, base_currency, display_currency, exchange_rates"
    )
    .eq("weekly_summary_enabled", true);

  if (prefError) {
    return { statusCode: 500, body: prefError.message };
  }

  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    return { statusCode: 500, body: userError.message };
  }

  const emailMap = new Map(
    (users?.users ?? [])
      .filter((user) => user.email)
      .map((user) => [user.id, user.email])
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const pref of preferences ?? []) {
    const email = emailMap.get(pref.user_id);
    if (!email) {
      skipped += 1;
      continue;
    }

    const timeZone = pref.weekly_summary_timezone || "UTC";
    const locale = pref.locale || FALLBACK_LOCALE;
    const baseCurrency = normalizeCurrency(pref.base_currency || FALLBACK_CURRENCY);
    const displayCurrency = normalizeCurrency(
      pref.display_currency || pref.base_currency || FALLBACK_CURRENCY,
    );
    const exchangeRates = sanitizeExchangeRates(pref.exchange_rates, baseCurrency);
    const formatCurrency = (value) =>
      buildMoneyFormatter({ locale, currency: displayCurrency }).format(value);
    const now = new Date();
    const nowParts = getZonedParts(now, timeZone);
    const scheduled = parseTime(pref.weekly_summary_time || "08:00");

    if (nowParts.weekday !== pref.weekly_summary_day) {
      skipped += 1;
      continue;
    }
    if (
      nowParts.hour < scheduled.hour ||
      (nowParts.hour === scheduled.hour && nowParts.minute < scheduled.minute)
    ) {
      skipped += 1;
      continue;
    }

    if (pref.weekly_summary_last_sent_at) {
      const lastSentDate = getLocalDateString(
        new Date(pref.weekly_summary_last_sent_at),
        timeZone
      );
      const todayDate = getLocalDateString(now, timeZone);
      if (lastSentDate === todayDate) {
        skipped += 1;
        continue;
      }
    }

    const { startDate, endDate, dueEndDate } = computeRange(nowParts);
    const monthRange = computeMonthRange(nowParts.year, nowParts.month);
    const rangeLabel = formatRangeLabel({ startDate, endDate, locale, timeZone });

    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, currency")
      .eq("user_id", pref.user_id);

    const accountCurrencyMap = new Map(
      (accounts ?? []).map((account) => [account.id, normalizeCurrency(account.currency)]),
    );

    const { data: weekTx } = await supabase
      .from("transactions")
      .select("type, date, amount, currency, account_id, category_id, is_transfer, is_reimbursement, notes")
      .eq("user_id", pref.user_id)
      .gte("date", startDate)
      .lte("date", endDate);

    const { data: monthTx } = await supabase
      .from("transactions")
      .select("type, date, amount, currency, account_id, category_id, is_transfer, is_reimbursement")
      .eq("user_id", pref.user_id)
      .gte("date", monthRange.startDate)
      .lte("date", monthRange.endDate);

    const { data: budgets } = await supabase
      .from("budgets")
      .select("amount, category_id")
      .eq("user_id", pref.user_id)
      .eq("month", monthRange.monthKey);

    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", pref.user_id);

    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("name, amount, currency, estimated_base_amount, last_billed_base_amount, next_due")
      .eq("user_id", pref.user_id)
      .eq("status", "active")
      .gte("next_due", endDate)
      .lte("next_due", dueEndDate);

    const categoryMap = new Map(
      (categories ?? []).map((category) => [category.id, category.name])
    );

    const weekTotals = new Map();
    let weekSpent = 0;
    let weekIncome = 0;
    (weekTx ?? []).forEach((tx) => {
      const txCurrency =
        tx.currency ||
        accountCurrencyMap.get(tx.account_id) ||
        baseCurrency;
      const convertedAmount =
        convertAmount({
          amount: tx.amount,
          fromCurrency: txCurrency,
          toCurrency: displayCurrency,
          baseCurrency,
          exchangeRates,
        }) ?? Number(tx.amount);
      const delta = getNetExpenseDelta({ ...tx, amount: convertedAmount });
      if (delta !== 0) {
        weekSpent += delta;
        const key = tx.category_id ?? "uncategorized";
        weekTotals.set(key, (weekTotals.get(key) ?? 0) + delta);
      }
      weekIncome += getIncomeDelta({ ...tx, amount: convertedAmount });
    });

    const topCategories = Array.from(weekTotals.entries())
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, value]) => ({
        name: categoryMap.get(id) ?? "Uncategorized",
        amount: value,
      }));

    const monthTotals = new Map();
    let monthSpent = 0;
    (monthTx ?? []).forEach((tx) => {
      const txCurrency =
        tx.currency ||
        accountCurrencyMap.get(tx.account_id) ||
        baseCurrency;
      const convertedAmount =
        convertAmount({
          amount: tx.amount,
          fromCurrency: txCurrency,
          toCurrency: displayCurrency,
          baseCurrency,
          exchangeRates,
        }) ?? Number(tx.amount);
      const delta = getNetExpenseDelta({ ...tx, amount: convertedAmount });
      if (delta !== 0) {
        monthSpent += delta;
        const key = tx.category_id ?? "uncategorized";
        monthTotals.set(key, (monthTotals.get(key) ?? 0) + delta);
      }
    });

    const budgetWarnings = [];

    const overallBudget = (budgets ?? []).find((b) => !b.category_id)?.amount;
    const overallBudgetDisplay =
      overallBudget && overallBudget > 0
        ? convertAmount({
            amount: overallBudget,
            fromCurrency: baseCurrency,
            toCurrency: displayCurrency,
            baseCurrency,
            exchangeRates,
          }) ?? Number(overallBudget)
        : 0;
    if (overallBudgetDisplay && overallBudgetDisplay > 0) {
      const ratio = monthSpent / overallBudgetDisplay;
      if (ratio >= 0.8) {
        budgetWarnings.push({
          label: "Overall budget",
          ratio,
          spent: monthSpent,
          budget: overallBudgetDisplay,
        });
      }
    }

    (budgets ?? [])
      .filter((b) => b.category_id)
      .forEach((b) => {
        if (b.amount <= 0) {
          return;
        }
        const displayBudget =
          convertAmount({
            amount: b.amount,
            fromCurrency: baseCurrency,
            toCurrency: displayCurrency,
            baseCurrency,
            exchangeRates,
          }) ?? Number(b.amount);
        const spent = monthTotals.get(b.category_id ?? "") ?? 0;
        const ratio = displayBudget > 0 ? spent / displayBudget : 0;
        if (ratio >= 0.8) {
          budgetWarnings.push({
            label: categoryMap.get(b.category_id ?? "") ?? "Uncategorized",
            ratio,
            spent,
            budget: displayBudget,
          });
        }
      });

    budgetWarnings.sort((a, b) => b.ratio - a.ratio);

    const html = buildEmailHtml({
      userName: "",
      rangeLabel,
      totalSpent: weekSpent,
      totalIncome: weekIncome,
      net: weekIncome - weekSpent,
      topCategories,
      budgetWarnings: budgetWarnings.slice(0, 3),
      subscriptions: (subscriptions ?? []).map((sub) => {
        const planningAmount =
          normalizeCurrency(sub.currency) === baseCurrency
            ? Number(sub.amount)
            : Number(
                sub.estimated_base_amount ??
                  sub.last_billed_base_amount ??
                  sub.amount,
              );
        const convertedAmount =
          normalizeCurrency(sub.currency) === baseCurrency
            ? convertAmount({
                amount: planningAmount,
                fromCurrency: baseCurrency,
                toCurrency: displayCurrency,
                baseCurrency,
                exchangeRates,
              }) ?? planningAmount
            : convertAmount({
                amount: planningAmount,
                fromCurrency: baseCurrency,
                toCurrency: displayCurrency,
                baseCurrency,
                exchangeRates,
              }) ?? planningAmount;
        return {
          name: sub.name,
          next_due: sub.next_due,
          amount: convertedAmount,
        };
      }),
      formatCurrency,
      displayCurrency,
    });

    try {
      await sendEmail(email, `CashCove weekly summary - ${rangeLabel}`, html);
      await supabase
        .from("user_preferences")
        .update({ weekly_summary_last_sent_at: now.toISOString() })
        .eq("user_id", pref.user_id);
      sent += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sent, skipped, errors }),
  };
};

export const handler = schedule("0 * * * *", runWeeklySummary);
