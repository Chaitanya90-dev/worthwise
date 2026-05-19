export type ParsedStructuredExpense = {
  amount: number | null;
  type: "expense" | "income";
  date: string;
  hasExplicitDate: boolean;
  merchant: string | null;
  notes: string | null;
  tags: string[];
  categoryHint: string | null;
  paymentHint: string | null;
  accountHint: string | null;
  categorySegment: string | null;
  paymentSegment: string | null;
  accountSegment: string | null;
};

type SegmentKey =
  | "merchant"
  | "notes"
  | "category"
  | "payment"
  | "account"
  | "tags";

type SegmentOccurrence = {
  key: SegmentKey;
  start: number;
  end: number;
};

type AmountCandidate = {
  value: number;
  start: number;
  end: number;
  score: number;
};

type CanonicalFieldKey =
  | "amount"
  | "merchant"
  | "notes"
  | "category"
  | "payment"
  | "account"
  | "tags"
  | "date"
  | "type";

const CURRENCY_TOKEN_REGEX =
  /(?:₹|\$|€|£|¥|₦|rs\.?|inr|usd|eur|gbp|aud|cad|nzd|sgd|aed|jpy|cny|chf|sek|nok|dkk|zar|kes|ngn)/i;
const AMOUNT_PREFIX_REGEX = new RegExp(
  `${CURRENCY_TOKEN_REGEX.source}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
  "gi",
);
const AMOUNT_SUFFIX_REGEX = new RegExp(
  `([\\d,]+(?:\\.\\d{1,2})?)\\s*${CURRENCY_TOKEN_REGEX.source}`,
  "gi",
);
const BARE_AMOUNT_REGEX = /\b(\d+(?:,\d{3})*(?:\.\d{1,2})?)\b/g;

const hasCurrencyToken = (value: string) => {
  const regex = new RegExp(CURRENCY_TOKEN_REGEX.source, "i");
  return regex.test(value);
};

const DATE_PATTERNS = [
  /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/i,
  /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/i,
  /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*(?:\s+\d{2,4})?)\b/i,
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s+\d{2,4})?)\b/i,
];

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MARKER_PATTERNS: Array<{ key: SegmentKey; regex: RegExp }> = [
  { key: "tags", regex: /\b(?:tags?|labels?)\b\s*/gi },
  { key: "category", regex: /\b(?:category|cat(?:egory)?|under)\b\s*/gi },
  {
    key: "payment",
    regex: /\b(?:paid\s+by|payment\s+by|via|using|through|mode)\b\s*/gi,
  },
  { key: "account", regex: /\b(?:from|account|acct|a\/c)\b\s*/gi },
  { key: "merchant", regex: /\bat\b\s*/gi },
  { key: "notes", regex: /\b(?:for|on)\b\s*/gi },
];

const COMMON_ALIASES: Array<[RegExp, string]> = [
  [/\ba\/c\b/g, "account"],
  [/\bacct\b/g, "account"],
  [/\bbob\b/g, "bank of baroda"],
  [/\bsbi\b/g, "state bank of india"],
  [/\bhdfc\b/g, "hdfc bank"],
  [/\bicici\b/g, "icici bank"],
  [/\bidfc\b/g, "idfc first bank"],
  [/\bkotak\b/g, "kotak bank"],
  [/\baxis\b/g, "axis bank"],
  [/\bygpay\b/g, "google pay upi"],
  [/\bgoogle\s+pay\b/g, "google pay upi"],
  [/\bphonepe\b/g, "phonepe upi"],
  [/\bpaytm\b/g, "paytm upi"],
  [/\bnet\s*banking\b/g, "bank transfer"],
];

const PAYMENT_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(?:upi|google pay|gpay|phonepe|paytm|bhim)\b/i, "upi"],
  [/\bcash\b/i, "cash"],
  [/\bcredit(?:\s*card)?\b|\bcc\b/i, "credit card"],
  [/\bdebit(?:\s*card)?\b/i, "debit card"],
  [/\b(?:neft|imps|bank transfer|transfer|netbanking)\b/i, "bank transfer"],
];

const ACCOUNT_NOISE_REGEX =
  /\b(?:upi|google pay|gpay|phonepe|paytm|bhim|cash|credit(?:\s*card)?|debit(?:\s*card)?|card|bank transfer|transfer|netbanking|neft|imps)\b/gi;

const HASH_TAG_REGEX = /(^|\s)#([a-z0-9][a-z0-9_-]*)/gi;

const KEY_VALUE_ALIASES: Record<string, CanonicalFieldKey> = {
  amount: "amount",
  amt: "amount",
  merchant: "merchant",
  payee: "merchant",
  store: "merchant",
  at: "merchant",
  notes: "notes",
  note: "notes",
  item: "notes",
  for: "notes",
  category: "category",
  cat: "category",
  payment: "payment",
  mode: "payment",
  method: "payment",
  via: "payment",
  account: "account",
  acct: "account",
  ac: "account",
  tags: "tags",
  labels: "tags",
  date: "date",
  type: "type",
};

const collapseWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

export const cleanSegment = (value: string) =>
  collapseWhitespace(value.replace(/^[,:;.\- ]+|[,:;.\- ]+$/g, ""));

const normalizeTag = (tag: string) =>
  cleanSegment(tag.replace(/^#/, "").replace(/_/g, " ")).toLowerCase();

export const normalizeLookupText = (value: string) => {
  let normalized = value.toLowerCase().replace(/&/g, " and ");
  for (const [pattern, replacement] of COMMON_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }
  normalized = normalized
    .replace(/[()/_-]+/g, " ")
    .replace(/[^a-z0-9@.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized;
};

export const tokenizeLookupText = (value: string) =>
  normalizeLookupText(value)
    .split(" ")
    .filter((token) => token.length > 0);

export const buildLookupAcronym = (value: string) =>
  tokenizeLookupText(value)
    .filter((token) => /^[a-z]+$/.test(token))
    .map((token) => token[0])
    .join("");

const toIsoDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const currentIsoDate = (now: Date) =>
  toIsoDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) ??
  now.toISOString().slice(0, 10);

const parseDateToken = (raw: string, now: Date): string | null => {
  const trimmed = collapseWhitespace(raw.replace(/,/g, " "));
  if (!trimmed) {
    return null;
  }

  const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    return toIsoDate(year, month, day);
  }

  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const rawYear = Number(dmy[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return toIsoDate(year, month, day);
  }

  const dayMonth = trimmed.match(
    /^(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{2,4}))?$/i,
  );
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthKey = dayMonth[2].slice(0, 4).toLowerCase();
    const month = MONTHS[monthKey] ?? MONTHS[monthKey.slice(0, 3)];
    if (month === undefined) {
      return null;
    }
    const rawYear = dayMonth[3] ? Number(dayMonth[3]) : now.getUTCFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return toIsoDate(year, month, day);
  }

  const monthDay = trimmed.match(
    /^([a-z]{3,9})\s+(\d{1,2})(?:\s+(\d{2,4}))?$/i,
  );
  if (monthDay) {
    const monthKey = monthDay[1].slice(0, 4).toLowerCase();
    const month = MONTHS[monthKey] ?? MONTHS[monthKey.slice(0, 3)];
    if (month === undefined) {
      return null;
    }
    const day = Number(monthDay[2]);
    const rawYear = monthDay[3] ? Number(monthDay[3]) : now.getUTCFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return toIsoDate(year, month, day);
  }

  return null;
};

const extractDate = (text: string, now: Date) => {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const parsed = parseDateToken(match[1], now);
    if (parsed) {
      return { date: parsed, raw: match[1], hasExplicitDate: true };
    }
  }

  return { date: currentIsoDate(now), raw: "", hasExplicitDate: false };
};

const extractHashTags = (text: string) => {
  const tags = new Set<string>();
  const stripped = text.replace(HASH_TAG_REGEX, (_match, prefix, rawTag) => {
    const normalized = normalizeTag(rawTag);
    if (normalized) {
      tags.add(normalized);
    }
    return prefix || " ";
  });

  return {
    tags: Array.from(tags),
    text: collapseWhitespace(stripped),
  };
};

const parseAmountNumber = (raw: string) => {
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
};

const parseKeyValueAmount = (raw: string) => {
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  if (!cleaned) {
    return null;
  }
  return parseAmountNumber(cleaned);
};

const buildAmountScore = (
  text: string,
  start: number,
  end: number,
  value: number,
  baseScore: number,
) => {
  const before = text.slice(Math.max(0, start - 18), start).toLowerCase();
  const after = text.slice(end, Math.min(text.length, end + 18)).toLowerCase();
  let score = baseScore;

  if (/(?:paid|spent|cost|amount|amt|price|total)\s*$/.test(before)) {
    score += 2;
  }
  if (/^(?:\s)*(?:at|for|via|using|through|cash|upi|card|category)\b/.test(after)) {
    score += 2;
  }
  if (value >= 10 && value <= 100000) {
    score += 1;
  }
  if (value < 5) {
    score -= 1;
  }
  if (/(?:ref|utr|txn|txnid|balance|bal|avl|account|acct|a\/c)\s*$/.test(before)) {
    score -= 4;
  }
  if (
    !hasCurrencyToken(text.slice(start, end)) &&
    /\b(?:bank|baroda|icici|hdfc|axis|sbi)\b/.test(before)
  ) {
    score -= 1;
  }

  return score;
};

const extractAmount = (text: string): { value: number; raw: string } | null => {
  const candidates: AmountCandidate[] = [];
  const pushMatches = (regex: RegExp, baseScore: number, captureIndex: number) => {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const rawValue = match[captureIndex];
      if (!rawValue) {
        continue;
      }
      const value = parseAmountNumber(rawValue);
      if (!value) {
        continue;
      }
      const start = match.index ?? 0;
      const end = start + match[0].length;
      candidates.push({
        value,
        start,
        end,
        score: buildAmountScore(text, start, end, value, baseScore),
      });
    }
  };

  pushMatches(AMOUNT_PREFIX_REGEX, 10, 1);
  pushMatches(AMOUNT_SUFFIX_REGEX, 10, 1);
  pushMatches(BARE_AMOUNT_REGEX, 4, 1);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.end !== a.end) {
      return b.end - a.end;
    }
    return a.start - b.start;
  });

  const best = candidates[0];
  return {
    value: best.value,
    raw: text.slice(best.start, best.end),
  };
};

const extractSegments = (text: string) => {
  const occurrences: SegmentOccurrence[] = [];

  for (const { key, regex } of MARKER_PATTERNS) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const start = match.index ?? 0;
      occurrences.push({
        key,
        start,
        end: start + match[0].length,
      });
    }
  }

  occurrences.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return b.end - a.end;
  });

  const filtered: SegmentOccurrence[] = [];
  for (const occurrence of occurrences) {
    const overlaps = filtered.some(
      (existing) =>
        occurrence.start < existing.end && occurrence.end > existing.start,
    );
    if (!overlaps) {
      filtered.push(occurrence);
    }
  }

  const segments: Partial<Record<SegmentKey, string>> = {};
  const consumedRanges: Array<{ start: number; end: number }> = [];

  filtered.forEach((occurrence, index) => {
    const next = filtered[index + 1];
    const rawValue = text.slice(occurrence.end, next?.start ?? text.length);
    const cleaned = cleanSegment(rawValue);
    if (cleaned && !segments[occurrence.key]) {
      segments[occurrence.key] = cleaned;
      consumedRanges.push({
        start: occurrence.start,
        end: next?.start ?? text.length,
      });
    }
  });

  consumedRanges.sort((a, b) => a.start - b.start);

  let cursor = 0;
  const leftoverParts: string[] = [];
  for (const range of consumedRanges) {
    if (range.start > cursor) {
      leftoverParts.push(text.slice(cursor, range.start));
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < text.length) {
    leftoverParts.push(text.slice(cursor));
  }

  return {
    segments,
    leftover: cleanSegment(leftoverParts.join(" ")),
  };
};

const cleanMerchant = (value: string | null) => {
  if (!value) {
    return null;
  }
  let cleaned = collapseWhitespace(value);
  cleaned = cleaned.replace(
    /^(?:paid|pay|spent|spend|bought|buy|ordered|order(?:ed)?|purchase(?:d)?|log(?:ged)?|add(?:ed)?|sent|send)\s+/i,
    "",
  );
  cleaned = cleaned.replace(/^(?:to|at)\s+/i, "");
  cleaned = cleanSegment(cleaned);
  return cleaned || null;
};

const cleanNotes = (value: string | null) => {
  if (!value) {
    return null;
  }
  let cleaned = collapseWhitespace(value);
  cleaned = cleaned.replace(/^(?:for|on)\s+/i, "");
  cleaned = cleaned.replace(
    /^(?:paid|pay|spent|spend|bought|buy|ordered|order(?:ed)?|log(?:ged)?|add(?:ed)?)\s+/i,
    "",
  );
  cleaned = cleanSegment(cleaned);
  return cleaned || null;
};

const parseTagList = (value: string | null) => {
  if (!value) {
    return [];
  }

  const cleaned = cleanSegment(value);
  if (!cleaned) {
    return [];
  }

  const segments = cleaned.includes(",")
    ? cleaned.split(",")
    : cleaned
        .split(/\s+/)
        .filter((token) => token.length > 0);

  const normalized = segments
    .map((segment) => normalizeTag(segment))
    .filter(Boolean);

  return Array.from(new Set(normalized));
};

const parseKeyValuePairs = (text: string, now: Date): ParsedStructuredExpense | null => {
  if (!/[;=:\n]/.test(text)) {
    return null;
  }

  const parts = text
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  let recognizedCount = 0;
  let amount: number | null = null;
  let merchant: string | null = null;
  let notes: string | null = null;
  let categoryHint: string | null = null;
  let paymentHint: string | null = null;
  let accountHint: string | null = null;
  let tags: string[] = [];
  let type: "expense" | "income" = "expense";
  let date: string | null = null;

  for (const part of parts) {
    const match = part.match(/^([a-z_ ]+)\s*[:=]\s*(.+)$/i);
    if (!match) {
      continue;
    }

    const rawKey = normalizeLookupText(match[1]).replace(/\s+/g, "");
    const canonical = KEY_VALUE_ALIASES[rawKey];
    if (!canonical) {
      continue;
    }

    recognizedCount += 1;
    const rawValue = cleanSegment(match[2].replace(/^["']|["']$/g, ""));
    if (!rawValue) {
      continue;
    }

    if (canonical === "amount") {
      amount = parseKeyValueAmount(rawValue);
      continue;
    }
    if (canonical === "merchant") {
      merchant = cleanSegment(rawValue) || null;
      continue;
    }
    if (canonical === "notes") {
      notes = cleanSegment(rawValue) || null;
      continue;
    }
    if (canonical === "category") {
      categoryHint = cleanSegment(rawValue) || null;
      continue;
    }
    if (canonical === "payment") {
      paymentHint = cleanSegment(rawValue) || null;
      continue;
    }
    if (canonical === "account") {
      accountHint = cleanSegment(rawValue) || null;
      continue;
    }
    if (canonical === "tags") {
      tags = parseTagList(rawValue);
      continue;
    }
    if (canonical === "date") {
      date = parseDateToken(rawValue, now);
      continue;
    }
    if (canonical === "type") {
      const lower = rawValue.toLowerCase();
      type =
        lower === "income" || lower === "in"
          ? "income"
          : lower === "expense" || lower === "out"
            ? "expense"
            : type;
    }
  }

  if (recognizedCount < 2) {
    return null;
  }

  const finalDate = date ?? currentIsoDate(now);
  return {
    amount,
    type,
    date: finalDate,
    hasExplicitDate: Boolean(date),
    merchant,
    notes,
    tags,
    categoryHint,
    paymentHint,
    accountHint,
    categorySegment: categoryHint,
    paymentSegment: paymentHint,
    accountSegment: accountHint,
  };
};

export const inferPaymentHint = (text: string) => {
  for (const [pattern, canonical] of PAYMENT_KEYWORDS) {
    if (pattern.test(text)) {
      return canonical;
    }
  }
  return "";
};

const stripPaymentNoise = (value: string) =>
  cleanSegment(value.replace(ACCOUNT_NOISE_REGEX, " "));

export const parseStructuredExpenseText = ({
  text,
  now = new Date(),
}: {
  text: string;
  now?: Date;
}): ParsedStructuredExpense => {
  const normalizedText = collapseWhitespace(text);

  const keyValueParsed = parseKeyValuePairs(normalizedText, now);
  if (keyValueParsed) {
    const paymentHint = keyValueParsed.paymentHint
      ? cleanSegment(keyValueParsed.paymentHint)
      : null;
    return {
      ...keyValueParsed,
      paymentHint:
        paymentHint ||
        cleanSegment(inferPaymentHint(normalizedText)) ||
        null,
    };
  }

  const { date, raw: dateRaw, hasExplicitDate } = extractDate(normalizedText, now);
  const hashTagExtraction = extractHashTags(normalizedText);

  let working = hashTagExtraction.text;
  if (dateRaw) {
    working = collapseWhitespace(working.replace(dateRaw, " "));
  }

  const amountMatch = extractAmount(working);
  if (amountMatch) {
    working = collapseWhitespace(working.replace(amountMatch.raw, " "));
  }

  const { segments, leftover } = extractSegments(working);
  const notesFromLeftover =
    !segments.notes && segments.merchant ? cleanNotes(leftover) : null;
  const explicitTags = parseTagList(segments.tags ?? null);

  let merchant = cleanMerchant(segments.merchant ?? null);
  if (!merchant && leftover) {
    merchant = cleanMerchant(leftover);
  }
  if (!segments.merchant && merchant) {
    merchant = cleanMerchant(stripPaymentNoise(merchant));
  }

  const notes = cleanNotes(segments.notes ?? notesFromLeftover ?? null);
  const categorySegment = cleanSegment(segments.category ?? "");
  const paymentSegment = cleanSegment(segments.payment ?? "");
  const accountSegment = cleanSegment(segments.account ?? "");
  const paymentHint = cleanSegment(paymentSegment || inferPaymentHint(normalizedText));
  const accountHint = cleanSegment(accountSegment || stripPaymentNoise(paymentSegment));
  const tags = Array.from(new Set([...hashTagExtraction.tags, ...explicitTags]));

  return {
    amount: amountMatch?.value ?? null,
    type: "expense",
    date,
    hasExplicitDate,
    merchant,
    notes,
    tags,
    categoryHint: categorySegment || null,
    paymentHint: paymentHint || null,
    accountHint: accountHint || null,
    categorySegment: categorySegment || null,
    paymentSegment: paymentSegment || null,
    accountSegment: accountSegment || null,
  };
};
