/**
 * Smart Text Parser — parse bank alerts, card notifications, and free-form text
 * into transaction rows for bulk import.
 */
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { TransactionRule } from "../types/finance";
import { parseStructuredExpenseText } from "./freeFormExpenseParser";
import { applyRulesToTransaction } from "./rules";
import type {
  ImportLookups,
  ImportDefaults,
  ParsedImportRow,
} from "./transactionImport";

dayjs.extend(customParseFormat);

/* ─── Types ──────────────────────────────────────────── */

export type SmartParsedLine = {
  date: string; // YYYY-MM-DD
  amount: number;
  type: "expense" | "income";
  merchant: string;
  notes: string;
  categoryHint: string;
  paymentHint: string; // e.g. "upi", "credit card", "cash"
  accountHint: string; // e.g. "9965", "OneCard"
  tags: string[];
  source: string; // template id that matched
};

export type SmartLineResult = {
  lineNumber: number;
  raw: string;
  status: "parsed" | "partial" | "failed";
  parsed: SmartParsedLine | null;
  error?: string;
};

export type SmartParseResult = {
  lines: SmartLineResult[];
  validRows: ParsedImportRow[];
  summary: {
    total: number;
    parsed: number;
    partial: number;
    failed: number;
  };
};

/* ─── SMS Template Engine ────────────────────────────── */

export type SmsTemplate = {
  id: string;
  label: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Partial<SmartParsedLine> | null;
};

/**
 * Normalise amount strings like "1,500.00", "$250", "EUR 800.00".
 */
const CURRENCY_TOKEN_PREFIX_REGEX =
  /^(?:rs\.?|inr|usd|eur|gbp|aud|cad|nzd|sgd|aed|jpy|cny|chf|sek|nok|dkk|zar|kes|ngn)\s*/i;

const parseAmount = (raw: string): number | null => {
  const cleaned = raw
    .replace(/[₹$€£¥₦,\s]/g, "")
    .replace(CURRENCY_TOKEN_PREFIX_REGEX, "");
  const num = Number(cleaned);
  return Number.isNaN(num) || num <= 0 ? null : num;
};

/**
 * Parse dates in common bank and statement formats.
 */
const SMART_DATE_FORMATS = [
  "DD-MMM-YY",
  "DD-MMM-YYYY",
  "DD MMM YYYY",
  "DD/MM/YYYY",
  "DD/MM/YY",
  "YYYY-MM-DD",
  "MMM DD, YYYY",
  "MMM D, YYYY",
  "DDMMMYY", // e.g. 05MAR26
  "DD-MM-YYYY",
  "DD-MM-YY",
  "D MMM YYYY",
];

const parseDate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Normalise "05MAR26" → "05-MAR-26" for dayjs
  const condensed = trimmed.replace(
    /^(\d{2})([A-Z]{3})(\d{2,4})$/i,
    "$1-$2-$3",
  );

  const parsed = dayjs(condensed, SMART_DATE_FORMATS, true);
  if (parsed.isValid()) return parsed.format("YYYY-MM-DD");

  // Fallback: try native dayjs parsing
  const fallback = dayjs(trimmed);
  return fallback.isValid() ? fallback.format("YYYY-MM-DD") : null;
};

const normalizeLookupText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9@.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildLookupAcronym = (value: string) =>
  normalizeLookupText(value)
    .split(" ")
    .filter((token) => /^[a-z]+$/.test(token))
    .map((token) => token[0])
    .join("");

const resolveHintLookup = ({
  hint,
  byName,
  byId,
  minimumScore = 0.62,
}: {
  hint: string;
  byName: Map<string, string>;
  byId: Map<string, string>;
  minimumScore?: number;
}) => {
  const normalizedHint = normalizeLookupText(hint);
  if (!normalizedHint) {
    return null;
  }

  const compactHint = normalizedHint.replace(/\s+/g, "");
  const hintDigits = normalizedHint.match(/\d{3,}/g) ?? [];

  let best: { id: string; name: string; score: number } | null = null;

  for (const [rawName, id] of byName.entries()) {
    const normalizedName = normalizeLookupText(rawName);
    if (!normalizedName) {
      continue;
    }

    let score = 0;
    if (normalizedName === normalizedHint) {
      score = 1;
    } else if (
      normalizedName.includes(normalizedHint) ||
      normalizedHint.includes(normalizedName)
    ) {
      score = 0.92;
    }

    const acronym = buildLookupAcronym(rawName);
    if (
      acronym &&
      (acronym === compactHint ||
        acronym.startsWith(compactHint) ||
        compactHint.startsWith(acronym))
    ) {
      score = Math.max(score, 0.84);
    }

    if (hintDigits.some((digits) => normalizedName.includes(digits))) {
      score = Math.max(score, 0.9);
    }

    if (!best || score > best.score) {
      best = {
        id,
        name: byId.get(id) ?? rawName,
        score,
      };
    }
  }

  if (!best || best.score < minimumScore) {
    return null;
  }

  return best;
};

/* ─── Bank SMS Templates ─────────────────────────────── */

export const SMS_TEMPLATES: SmsTemplate[] = [
  // ── OneCard / BOB Financial ──
  {
    id: "onecard",
    label: "OneCard (BOB Financial)",
    pattern:
      /(?:transaction|txn)\s+(?:of\s+)?(?:rs\.?|inr)\s*([\d,.]+)\s+(?:on\s+)?(?:your\s+)?onecard\s+(?:on\s+)?([\w\d\s,-]+?)\s+(?:at|to)\s+(.+?)(?:\.\s*avl|\s+avl|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[2]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[3]?.trim() || "",
        paymentHint: "credit card",
        accountHint: "OneCard",
        source: "onecard",
      };
    },
  },
  // Alternate OneCard format: "Rs.1500 spent on OneCard at MERCHANT on DATE"
  {
    id: "onecard-alt",
    label: "OneCard (BOB Financial) alt",
    pattern:
      /(?:rs\.?|inr)\s*([\d,.]+)\s+(?:spent|used|debited)\s+(?:on\s+)?(?:your\s+)?onecard\s+(?:at\s+)(.+?)\s+on\s+([\w\d\s,-]+?)(?:\.\s|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[2]?.trim() || "",
        paymentHint: "credit card",
        accountHint: "OneCard",
        source: "onecard-alt",
      };
    },
  },

  // ── Amazon Pay ICICI Credit Card ──
  {
    id: "icici-cc",
    label: "ICICI Bank Credit Card",
    pattern:
      /(?:icici\s+bank\s+)?credit\s*card\s+(?:xx|x{2,})(\d{3,4})\s+(?:has\s+been\s+)?used\s+(?:for\s+)?(?:a\s+)?(?:transaction\s+(?:of\s+)?)?(?:rs\.?|inr)\s*([\d,.]+)\s+(?:on\s+)([\w\d\s,]+?)(?:\s+at\s+|\.\s*info:\s*)(.+?)(?:\.\s*(?:the\s+)?avl|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[2]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[4]?.replace(/^raz\*/i, "").trim() || "",
        notes: `Card XX${m[1]}`,
        paymentHint: "credit card",
        accountHint: m[1],
        source: "icici-cc",
      };
    },
  },
  // ICICI alternate: "INR 369.00 spent on ICICI CC XX1004 at MERCHANT on DATE"
  {
    id: "icici-cc-alt",
    label: "ICICI CC alt",
    pattern:
      /(?:rs\.?|inr)\s*([\d,.]+)\s+(?:spent|debited|used)\s+on\s+(?:your\s+)?icici\s+(?:bank\s+)?(?:credit\s*card|cc)\s+(?:xx|x{2,})(\d{3,4})\s+(?:at\s+)(.+?)\s+on\s+([\w\d\s,-]+?)(?:\.\s|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[4]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[3]?.replace(/^raz\*/i, "").trim() || "",
        notes: `Card XX${m[2]}`,
        paymentHint: "credit card",
        accountHint: m[2],
        source: "icici-cc-alt",
      };
    },
  },

  // ── Bank of Baroda (Debit / UPI) ──
  {
    id: "bob-debit",
    label: "Bank of Baroda debit",
    pattern:
      /a\/c\s*(?:xx|x{2,})(\d{3,6})\s+(?:debited|debit)\s+(?:(?:rs\.?|inr)\s*)?([\d,.]+)\s+(?:on\s+)?([\w\d\s,-]+?)(?:\s+(?:upi|neft|imps|transfer)[\s/]*(.+?))?(?:\.\s*avl|\s+avl|\s+bal|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[2]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      const upiDetails = m[4]?.trim() || "";
      const merchant =
        upiDetails.split("/").filter(Boolean).pop() || upiDetails || "";
      return {
        amount,
        date,
        type: "expense",
        merchant: merchant.trim(),
        notes: `A/c XX${m[1]}`,
        paymentHint: upiDetails ? "upi" : "bank",
        accountHint: m[1],
        source: "bob-debit",
      };
    },
  },
  // BOB debit alternate format: "Rs.60.00 Dr. from A/C XXXXXX9965 and Cr. to 9823742883@okbizaxis..."
  {
    id: "bob-debit-alt",
    label: "Bank of Baroda debit alt",
    pattern:
      /(?:rs\.?|inr|₹)\s*([\d,.]+)\s+dr\.\s+(?:from\s+)?a\/c\s*(?:xx|x{2,})(\d{3,6})\s+and\s+cr\.\s+(?:to\s+)?([\w\d\s@.-]+?)(?:\.\s*ref|ref|\.\s*avl|\s+avl|\(|$)[^(]*\(?(\d{4}[:/-]\d{2}[:/-]\d{2})/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      // Date is extracted as YYYY:MM:DD / YYYY-MM-DD
      const dateStr = m[4]?.replace(/:/g, "-");
      const date = parseDate(dateStr);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[3]?.trim() || "",
        notes: `A/c XX${m[2]}`,
        paymentHint: m[3]?.includes("@") ? "upi" : "bank",
        accountHint: m[2],
        source: "bob-debit-alt",
      };
    },
  },
  // BOB credit (incoming)
  {
    id: "bob-credit",
    label: "Bank of Baroda credit",
    pattern:
      /a\/c\s*(?:xx|x{2,})(\d{3,6})\s+(?:credited|credit)\s+(?:(?:rs\.?|inr)\s*)?([\d,.]+)\s+(?:on\s+)?([\w\d\s,-]+?)(?:\.\s|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[2]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "income",
        merchant: "",
        notes: `A/c XX${m[1]}`,
        paymentHint: "bank",
        accountHint: m[1],
        source: "bob-credit",
      };
    },
  },

  // ── Generic UPI (GPay / PhonePe / Paytm / any) ──
  {
    id: "upi-paid",
    label: "UPI payment",
    pattern:
      /(?:rs\.?|inr|₹)\s*([\d,.]+)\s+(?:paid|sent|transferred)\s+to\s+(.+?)\s+(?:via|through|using)\s+(.+?)\s+(?:upi\s+)?on\s+([\w\d\s,/-]+?)(?:\.\s*upi|\s+upi|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[4]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[2]?.trim() || "",
        notes: `via ${m[3]?.trim() || "UPI"}`,
        paymentHint: "upi",
        source: "upi-paid",
      };
    },
  },
  // UPI received
  {
    id: "upi-received",
    label: "UPI received",
    pattern:
      /(?:received|got)\s+(?:rs\.?|inr|₹)\s*([\d,.]+)\s+from\s+(.+?)\s+(?:via|through|using)\s+(.+?)\s+(?:upi\s+)?on\s+([\w\d\s,/-]+?)(?:\.\s|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[4]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "income",
        merchant: m[2]?.trim() || "",
        notes: `via ${m[3]?.trim() || "UPI"}`,
        paymentHint: "upi",
        source: "upi-received",
      };
    },
  },
  // UPI app history style: "Paid to Zomato  ₹425  7 Mar 2026"
  {
    id: "upi-history",
    label: "UPI app history",
    pattern:
      /(?:paid\s+to|sent\s+to)\s+(.+?)\s+(?:rs\.?|inr|₹)\s*([\d,.]+)\s+([\w\d\s,/-]+?)$/i,
    extract: (m) => {
      const amount = parseAmount(m[2]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[1]?.trim() || "",
        paymentHint: "upi",
        source: "upi-history",
      };
    },
  },
  // Reverse: "Received from Rahul ₹500 6 Mar 2026"
  {
    id: "upi-history-in",
    label: "UPI app history in",
    pattern:
      /(?:received\s+from|got\s+from)\s+(.+?)\s+(?:rs\.?|inr|₹)\s*([\d,.]+)\s+([\w\d\s,/-]+?)$/i,
    extract: (m) => {
      const amount = parseAmount(m[2]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "income",
        merchant: m[1]?.trim() || "",
        paymentHint: "upi",
        source: "upi-history-in",
      };
    },
  },

  // ── Generic Credit Card ──
  {
    id: "generic-cc",
    label: "Generic credit card",
    pattern:
      /(?:cc|credit\s*card)\s+(?:xx|x{2,})(\d{3,4})\s+(?:used|charged|debited)\s+(?:for\s+)?(?:rs\.?|inr)\s*([\d,.]+)\s+(?:at\s+)(.+?)\s+on\s+([\w\d\s,-]+?)(?:\.\s|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[2]);
      const date = parseDate(m[4]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[3]?.trim() || "",
        notes: `Card XX${m[1]}`,
        paymentHint: "credit card",
        source: "generic-cc",
      };
    },
  },

  // ── Generic bank debit SMS ──
  {
    id: "generic-debit",
    label: "Generic bank debit",
    pattern:
      /(?:rs\.?|inr)\s*([\d,.]+)\s+(?:debited|withdrawn)\s+(?:from\s+)?(?:a\/c\s*)?(?:xx|x{2,})?(\d{3,6})?\s*on\s+([\w\d\s,-]+?)(?:\s+(?:for|to|at)\s+(.+?))?(?:\.\s*avl|\s+avl|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "expense",
        merchant: m[4]?.trim() || "",
        notes: m[2] ? `A/c XX${m[2]}` : "",
        paymentHint: "bank",
        source: "generic-debit",
      };
    },
  },

  // ── Generic bank credit SMS ──
  {
    id: "generic-credit",
    label: "Generic bank credit",
    pattern:
      /(?:rs\.?|inr)\s*([\d,.]+)\s+(?:credited)\s+(?:to\s+)?(?:a\/c\s*)?(?:xx|x{2,})?(\d{3,6})?\s*on\s+([\w\d\s,-]+?)(?:\.\s|$)/i,
    extract: (m) => {
      const amount = parseAmount(m[1]);
      const date = parseDate(m[3]);
      if (!amount || !date) return null;
      return {
        amount,
        date,
        type: "income",
        merchant: "",
        notes: m[2] ? `A/c XX${m[2]}` : "",
        paymentHint: "bank",
        source: "generic-credit",
      };
    },
  },
];

/* ─── Free-form Line Parser ──────────────────────────── */

const DATE_REGEX =
  /(?:(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4})|((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s+\d{2,4})?))/i;

export const parseFreeFormLine = (line: string): SmartParsedLine | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const parsed = parseStructuredExpenseText({
    text: trimmed,
    now: new Date(),
  });
  if (!parsed.amount) return null;

  return {
    date: parsed.hasExplicitDate ? parsed.date : dayjs().format("YYYY-MM-DD"),
    amount: parsed.amount,
    type: parsed.type,
    merchant: parsed.merchant ?? "",
    notes: parsed.notes ?? "",
    categoryHint: parsed.categoryHint ?? "",
    paymentHint: parsed.paymentHint ?? "",
    accountHint: parsed.accountHint ?? "",
    tags: parsed.tags ?? [],
    source: parsed.hasExplicitDate ? "free-form" : "free-form-no-date",
  };
};

/* ─── Main Parser ────────────────────────────────────── */

const matchTemplate = (line: string): SmartParsedLine | null => {
  for (const template of SMS_TEMPLATES) {
    const match = line.match(template.pattern);
    if (match) {
      const extracted = template.extract(match);
      if (extracted) {
        return {
          date: extracted.date ?? dayjs().format("YYYY-MM-DD"),
          amount: extracted.amount ?? 0,
          type: extracted.type ?? "expense",
          merchant: extracted.merchant ?? "",
          notes: extracted.notes ?? "",
          categoryHint: extracted.categoryHint ?? "",
          paymentHint: extracted.paymentHint ?? "",
          accountHint: extracted.accountHint ?? "",
          tags: extracted.tags ?? [],
          source: extracted.source ?? template.id,
        };
      }
    }
  }
  return null;
};

const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

/**
 * Heuristic to detect if a line looks like the start of a new transaction.
 * Used to stitch together SMS messages that were pasted across multiple lines.
 */
const isNewTransactionStart = (line: string): boolean => {
  const lower = line.toLowerCase();

  // Explicit transaction starters in SMS formatting
  if (
    lower.startsWith("rs.") ||
    lower.startsWith("inr") ||
    lower.startsWith("usd") ||
    lower.startsWith("eur") ||
    lower.startsWith("gbp") ||
    lower.startsWith("₹") ||
    lower.startsWith("$") ||
    lower.startsWith("€") ||
    lower.startsWith("£")
  )
    return true;
  if (
    lower.startsWith("your ") ||
    lower.startsWith("a/c ") ||
    lower.startsWith("ac ")
  )
    return true;
  if (lower.startsWith("transaction") || lower.startsWith("txn")) return true;
  if (
    lower.startsWith("paid ") ||
    lower.startsWith("sent ") ||
    lower.startsWith("received ")
  )
    return true;
  if (lower.startsWith("dear ") || lower.startsWith("hello ")) return true;

  // Date starts line: "Mar 5 lunch", "2026-03-05 uber", "07/03/26 food"
  const dateMatch = lower.match(DATE_REGEX);
  if (dateMatch && dateMatch.index === 0) return true;

  // Wait, if it's very short (like "Rs.60.00"), it's definitely a start.
  // If it doesn't match above, it's likely a continuation of the previous line.
  return false;
};

/**
 * If the user pastes an SMS that spans multiple lines, we want to stitch them back
 * together so the regex templates match. If they separate them with a double-newline,
 * that breaks the stitch.
 */
const stitchLines = (text: string): string[] => {
  // First split by double-newlines to forcefully separate messages
  const blocks = text.split(/\n\s*\n/);
  const result: string[] = [];

  for (const block of blocks) {
    const lines = splitLines(block);
    if (lines.length === 0) continue;

    let current = lines[0];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // If the line strongly looks like a new transaction start, push the current and start new
      if (isNewTransactionStart(line)) {
        result.push(current);
        current = line;
      } else {
        // Otherwise, it's probably a wrapped line, so stitch it (with a space)
        current += " " + line;
      }
    }
    result.push(current);
  }

  return result;
};

export const parseSmartText = ({
  text,
  defaults,
  lookups,
  rules = [],
}: {
  text: string;
  defaults: ImportDefaults;
  lookups: ImportLookups;
  rules?: TransactionRule[];
}): SmartParseResult => {
  const rawLines = stitchLines(text);
  const lines: SmartLineResult[] = [];
  const validRows: ParsedImportRow[] = [];

  let parsed = 0;
  let partial = 0;
  let failed = 0;

  rawLines.forEach((raw, index) => {
    const lineNumber = index + 1;

    // Try template match first, then free-form
    let result = matchTemplate(raw);
    let status: SmartLineResult["status"] = "parsed";

    if (!result) {
      result = parseFreeFormLine(raw);
      if (result) {
        status = result.source === "free-form-no-date" ? "partial" : "parsed";
      }
    }

    if (!result) {
      lines.push({
        lineNumber,
        raw,
        status: "failed",
        parsed: null,
        error: "Could not extract date or amount",
      });
      failed += 1;
      return;
    }

    if (status === "partial") {
      partial += 1;
    } else {
      parsed += 1;
    }

    // Apply rules engine
    const ruleResult = applyRulesToTransaction(
      {
        merchant: result.merchant || null,
        notes: result.notes || null,
        type: result.type,
        category_id: null,
        tags: result.tags,
      },
      rules,
    );

    // Resolve category from rules or defaults
    let categoryId = ruleResult.category_id || defaults.defaultCategoryId || null;
    let categoryLabel = "Uncategorized";
    if (!categoryId && result.categoryHint.trim()) {
      const resolvedCategory = resolveHintLookup({
        hint: result.categoryHint,
        byName: lookups.categoryByName,
        byId: lookups.categoryById,
      });
      if (resolvedCategory) {
        categoryId = resolvedCategory.id;
        categoryLabel = resolvedCategory.name;
      }
    }
    if (categoryId) {
      categoryLabel = lookups.categoryById.get(categoryId) ?? "Default category";
    }

    // Resolve payment method from hint or defaults
    let paymentId = defaults.defaultPaymentId || null;
    let paymentLabel = "Unspecified";
    const resolvedPayment = resolveHintLookup({
      hint: result.paymentHint,
      byName: lookups.paymentByName,
      byId: lookups.paymentById,
    });
    if (resolvedPayment) {
      paymentId = resolvedPayment.id;
      paymentLabel = resolvedPayment.name;
    }
    if (paymentId && paymentLabel === "Unspecified") {
      paymentLabel = lookups.paymentById.get(paymentId) ?? "Default payment";
    }

    // Resolve account from hint or defaults
    let accountId = defaults.defaultAccountId || null;
    let accountLabel = "Unspecified";
    const accountHints = [result.accountHint, result.paymentHint].filter(Boolean);
    for (const hint of accountHints) {
      const resolvedAccount = resolveHintLookup({
        hint,
        byName: lookups.accountByName,
        byId: lookups.accountById,
      });
      if (resolvedAccount) {
        accountId = resolvedAccount.id;
        accountLabel = resolvedAccount.name;
        break;
      }
    }
    if (accountId && accountLabel === "Unspecified") {
      accountLabel = lookups.accountById.get(accountId) ?? "Default account";
    }

    const tags = ruleResult.tags;

    lines.push({ lineNumber, raw, status, parsed: result });

    validRows.push({
      rowNumber: lineNumber,
      data: {
        type: result.type,
        date: result.date,
        amount: result.amount,
        category_id: categoryId,
        payment_method_id: paymentId,
        account_id: accountId,
        merchant: (ruleResult.merchant ?? result.merchant) || null,
        notes: result.notes || null,
        tags,
        is_recurring: defaults.recurring,
      },
      preview: {
        date: result.date,
        type: result.type,
        amount: result.amount,
        category: categoryLabel,
        payment: paymentLabel,
        account: accountLabel,
        merchant: (ruleResult.merchant ?? result.merchant) || "-",
        notes: result.notes || "-",
        tags: tags.length > 0 ? tags.join(", ") : "-",
      },
      warnings: status === "partial" ? ["Date not found; using today."] : [],
    });
  });

  return {
    lines,
    validRows,
    summary: {
      total: rawLines.length,
      parsed,
      partial,
      failed,
    },
  };
};
