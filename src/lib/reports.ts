import dayjs from "dayjs";
import type { Transaction } from "../types/finance";
import { formatINR } from "./format";
import {
  getDisplayCategoryId,
  getTransactionCounterpartyName,
  getIncomeDelta,
  getNetExpenseCategoryKey,
  getNetExpenseDelta,
} from "./transactions";

export type ChangeSummary = {
  label: string;
  delta: number;
  color: string;
};

export type CategoryTrendSeries = {
  key: string;
  label: string;
};

export const getDefaultReportRange = () => ({
  start: dayjs().startOf("month").toDate(),
  end: dayjs().endOf("month").toDate(),
});

export const normalizeReportRange = (start: Date | null, end: Date | null) => {
  if (!start || !end) {
    return { startDate: "", endDate: "", spanDays: 0 };
  }
  const startDay = dayjs(start);
  const endDay = dayjs(end);
  if (startDay.isAfter(endDay, "day")) {
    return {
      startDate: endDay.format("YYYY-MM-DD"),
      endDate: startDay.format("YYYY-MM-DD"),
      spanDays: startDay.diff(endDay, "day") + 1,
    };
  }
  return {
    startDate: startDay.format("YYYY-MM-DD"),
    endDate: endDay.format("YYYY-MM-DD"),
    spanDays: endDay.diff(startDay, "day") + 1,
  };
};

export const inDateRange = (tx: Transaction, start: string, end: string) =>
  tx.date >= start && tx.date <= end;

export const sumByType = (
  transactions: Transaction[],
  type: "income" | "expense"
) =>
  transactions.reduce((sum, tx) => {
    if (type === "income") {
      return sum + getIncomeDelta(tx);
    }
    return sum + getNetExpenseDelta(tx);
  }, 0);

export const buildChange = (current: number, previous: number): ChangeSummary => {
  if (previous === 0) {
    return {
      label: current === 0 ? "0%" : "New",
      delta: current,
      color: current === 0 ? "gray" : "teal",
    };
  }
  const diff = current - previous;
  const percent = (diff / previous) * 100;
  const sign = percent >= 0 ? "+" : "";
  return {
    label: `${sign}${percent.toFixed(1)}%`,
    delta: diff,
    color: percent >= 0 ? "teal" : "red",
  };
};

const escapeCsvValue = (value: string) => {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

export const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document?.createElement("a");
  if (!link) {
    URL.revokeObjectURL(url);
    return;
  }
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const resolveName = (id: string | null | undefined, map: Map<string, string>) => {
  if (!id) return "-";
  return map.get(id) ?? "-";
};

const resolveCategoryLabel = (id: string | null | undefined, map: Map<string, string>) => {
  if (!id) return "Uncategorized";
  if (id === "uncategorized") return "Uncategorized";
  if (id === "other") return "Other";
  return map.get(id) ?? "Unknown";
};

export const buildReportCsvRows = (
  transactions: Transaction[],
  categoryMap: Map<string, string>,
  accountMap: Map<string, string>,
  paymentMap: Map<string, string>
) => {
  const header = [
    "Date",
    "Type",
    "Category",
    "Amount",
    "Account",
    "Payment method",
    "Transfer",
    "Counterparty",
    "Notes",
    "Tags",
  ];
  const sorted = [...transactions].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
  const rows = sorted.map((tx) => {
    const tags = tx.tags?.map((tag) => tag.name).join(" | ") ?? "";
    const notes = tx.notes ?? tx.notes_enc ?? "";
    const displayCategoryId = getDisplayCategoryId(tx);
    return [
      tx.date,
      tx.type,
      resolveCategoryLabel(displayCategoryId ?? null, categoryMap),
      tx.amount.toFixed(2),
      resolveName(tx.account_id ?? null, accountMap),
      resolveName(tx.payment_method_id ?? null, paymentMap),
      tx.is_transfer ? "Yes" : "No",
      getTransactionCounterpartyName(tx),
      notes,
      tags,
    ];
  });
  return [header, ...rows];
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const buildReportHtml = (payload: {
  rangeLabel: string;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  categoryItems: Array<{ name: string; value: number }>;
  transactions: Transaction[];
  categoryMap: Map<string, string>;
}) => {
  const rowsHtml =
    payload.transactions.length === 0
      ? "<tr><td colspan=\"6\">No transactions in this range.</td></tr>"
      : payload.transactions
          .map((tx) => {
            const displayCategoryId = getDisplayCategoryId(tx);
            const category = resolveCategoryLabel(displayCategoryId ?? null, payload.categoryMap);
            const merchant = getTransactionCounterpartyName(tx);
            const note = tx.notes ?? tx.notes_enc ?? "";
            return `<tr>
  <td>${escapeHtml(dayjs(tx.date).format("DD MMM YYYY"))}</td>
  <td>${escapeHtml(tx.type)}</td>
  <td>${escapeHtml(category)}</td>
  <td>${escapeHtml(formatINR(tx.amount))}</td>
  <td>${escapeHtml(merchant)}</td>
  <td>${escapeHtml(note)}</td>
</tr>`;
          })
          .join("");
  const categoryHtml =
    payload.categoryItems.length === 0
      ? "<li>No category data yet.</li>"
      : payload.categoryItems
          .map(
            (item) =>
              `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(
                formatINR(item.value)
              )}</strong></li>`
          )
          .join("");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>CashCove report</title>
    <style>
      body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #0f172a; margin: 32px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      .muted { color: #64748b; font-size: 12px; }
      .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
      .summary div { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
      .summary strong { display: block; font-size: 18px; margin-top: 4px; }
      ul { list-style: none; padding: 0; margin: 0; }
      li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
      th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    </style>
  </head>
  <body>
    <h1>CashCove report</h1>
    <div class="muted">${escapeHtml(payload.rangeLabel)}</div>
    <section class="summary">
      <div><span class="muted">Income</span><strong>${escapeHtml(
        formatINR(payload.incomeTotal)
      )}</strong></div>
      <div><span class="muted">Expenses</span><strong>${escapeHtml(
        formatINR(payload.expenseTotal)
      )}</strong></div>
      <div><span class="muted">Net</span><strong>${escapeHtml(
        formatINR(payload.netTotal)
      )}</strong></div>
    </section>
    <h2>Top categories</h2>
    <ul>${categoryHtml}</ul>
    <h2>Transactions</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Amount</th>
          <th>Counterparty</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;
};

export const openPrintWindow = (title: string, html: string) => {
  const popup = globalThis.window?.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.document.title = title;
  popup.focus();
  popup.setTimeout(() => popup.print(), 300);
};

export const buildCategoryTrendData = (
  transactions: Transaction[],
  categoryMap: Map<string, string>,
  startDate: string,
  endDate: string,
  mode: "top" | "all" = "top"
): { data: Array<Record<string, number | string>>; series: CategoryTrendSeries[] } => {
  if (!startDate || !endDate) {
    return { data: [], series: [] };
  }

  const rangeMonths: Array<{ key: string; label: string }> = [];
  let cursor = dayjs(startDate).startOf("month");
  const endMonth = dayjs(endDate).startOf("month");
  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, "month")) {
    rangeMonths.push({
      key: cursor.format("YYYY-MM"),
      label: cursor.format("MMM YY"),
    });
    cursor = cursor.add(1, "month");
  }

  const totalsByCategory = new Map<string, number>();
  transactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    const key = getNetExpenseCategoryKey(tx) ?? "uncategorized";
    totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + delta);
  });

  const ranked = Array.from(totalsByCategory.entries())
    .filter(([, value]) => value > 0)
    .sort(
      (a, b) => b[1] - a[1]
    );
  const top = ranked.slice(0, 5);
  const topKeys = new Set(top.map(([key]) => key));
  const seriesSource = mode === "all" ? ranked : top;
  const series: CategoryTrendSeries[] = seriesSource.map(([key]) => ({
    key,
    label: resolveCategoryLabel(key, categoryMap),
  }));

  if (mode === "top" && ranked.length > top.length) {
    series.push({ key: "other", label: "Other" });
  }

  const rows = rangeMonths.map((month) => {
    const row: Record<string, number | string> = { month: month.label };
    series.forEach((item) => {
      row[item.key] = 0;
    });
    return { key: month.key, row };
  });

  const rowMap = new Map(rows.map((item) => [item.key, item.row]));

  transactions.forEach((tx) => {
    const delta = getNetExpenseDelta(tx);
    if (delta === 0) {
      return;
    }
    const monthKey = dayjs(tx.date).format("YYYY-MM");
    const row = rowMap.get(monthKey);
    if (!row) return;
    const rawKey = getNetExpenseCategoryKey(tx) ?? "uncategorized";
    const bucketKey =
      mode === "top" ? (topKeys.has(rawKey) ? rawKey : "other") : rawKey;
    row[bucketKey] = Number(row[bucketKey] ?? 0) + delta;
  });

  rows.forEach(({ row }) => {
    series.forEach((item) => {
      const value = Number(row[item.key] ?? 0);
      row[item.key] = value < 0 ? 0 : value;
    });
  });

  return { data: rows.map((item) => item.row), series };
};
