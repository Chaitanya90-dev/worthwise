import {
  buildLookupAcronym,
  cleanSegment,
  inferPaymentHint,
  normalizeLookupText,
  parseStructuredExpenseText,
  tokenizeLookupText,
} from "../../../src/lib/freeFormExpenseParser.ts";

export type ParserLookupItem = {
  id: string;
  name: string;
  type?: string | null;
};

export type ParsedTelegramMessage = {
  amount: number | null;
  type: "expense" | "income";
  date: string;
  hasExplicitDate: boolean;
  normalizedText: string;
  merchant: string | null;
  notes: string | null;
  tags: string[];
  categoryHint: string | null;
  paymentHint: string | null;
  accountHint: string | null;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  accountId: string | null;
  accountName: string | null;
};

type EntityKind = "category" | "payment" | "account";

const ACCOUNT_NOISE_REGEX =
  /\b(?:upi|google pay|gpay|phonepe|paytm|bhim|cash|credit(?:\s*card)?|debit(?:\s*card)?|card|bank transfer|transfer|netbanking|neft|imps)\b/gi;
const TELEGRAM_LINE_PREFIX_REGEX = /^[>\-–—*•]+[\s:.-]*/;
const TELEGRAM_KEY_VALUE_LINE_REGEX = /^[a-z_ ]+\s*[:=]\s*.+$/i;
const INCOME_TEXT_REGEX =
  /\b(?:received|got|credited|salary|refund(?:ed)?|cashback|interest|reimbursement|reimbursed|earned|sold|collected)\b/i;
const WEAK_INCOME_MERCHANT_REGEX =
  /^(?:received|got|credited|salary|refund(?:ed)?|cashback|interest|reimbursement|reimbursed|earned|sold|collected)\b/i;
const OPTIONAL_CURRENCY_TOKEN =
  /(?:₹|\$|€|£|¥|₦|rs\.?|inr|usd|eur|gbp|aud|cad|nzd|sgd|aed|jpy|cny|chf|sek|nok|dkk|zar|kes|ngn)?/i;
const INCOME_AMOUNT_PATTERNS = [
  new RegExp(
    `\\b(?:received|got|credited)\\s+(?:an?\\s+amount\\s+of\\s+)?${OPTIONAL_CURRENCY_TOKEN.source}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
    "i",
  ),
  new RegExp(
    `\\b(?:salary|refund(?:ed)?|cashback|interest|reimbursement|reimbursed|earned|sold|collected)\\s+(?:of\\s+)?${OPTIONAL_CURRENCY_TOKEN.source}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
    "i",
  ),
];

const GENERIC_FILLER_WORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "me",
  "and",
]);

const CATEGORY_THRESHOLD = 0.6;
const PAYMENT_THRESHOLD = 0.62;
const ACCOUNT_THRESHOLD = 0.62;

const collapseWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const stripPaymentNoise = (value: string) =>
  cleanSegment(value.replace(ACCOUNT_NOISE_REGEX, " "));

const tokenize = (value: string) =>
  tokenizeLookupText(value).filter((token) => !GENERIC_FILLER_WORDS.has(token));

const scoreEntityMatch = (
  hint: string,
  candidate: ParserLookupItem,
  kind: EntityKind,
) => {
  const normalizedHint = normalizeLookupText(hint);
  const normalizedCandidate = normalizeLookupText(candidate.name);
  if (!normalizedHint || !normalizedCandidate) {
    return 0;
  }

  if (normalizedHint === normalizedCandidate) {
    return 1;
  }

  let score = 0;
  if (
    normalizedCandidate.includes(normalizedHint) ||
    normalizedHint.includes(normalizedCandidate)
  ) {
    score = 0.92;
  }

  const hintTokens = tokenize(normalizedHint);
  const candidateTokens = new Set(tokenize(normalizedCandidate));
  if (hintTokens.length > 0) {
    const overlapCount = hintTokens.filter((token) => candidateTokens.has(token)).length;
    if (overlapCount > 0) {
      const overlapScore = 0.45 + (overlapCount / hintTokens.length) * 0.45;
      score = Math.max(score, overlapScore);
    }
  }

  const compactHint = normalizedHint.replace(/\s+/g, "");
  const acronym = buildLookupAcronym(candidate.name);
  if (
    acronym &&
    (acronym === compactHint ||
      acronym.startsWith(compactHint) ||
      compactHint.startsWith(acronym))
  ) {
    score = Math.max(score, 0.84);
  }

  const digitHints = normalizedHint.match(/\d{3,}/g) ?? [];
  if (digitHints.some((digits) => normalizedCandidate.includes(digits))) {
    score = Math.max(score, 0.9);
  }

  if (kind === "payment") {
    const canonical = inferPaymentHint(normalizedHint);
    if (canonical && normalizedCandidate.includes(canonical)) {
      score = Math.max(score, 0.94);
    }
  }

  return score;
};

const resolveEntity = (
  hints: Array<string | null | undefined>,
  items: ParserLookupItem[],
  kind: EntityKind,
) => {
  const threshold =
    kind === "category"
      ? CATEGORY_THRESHOLD
      : kind === "payment"
        ? PAYMENT_THRESHOLD
        : ACCOUNT_THRESHOLD;

  let best:
    | { item: ParserLookupItem; score: number }
    | null = null;

  for (const hint of hints) {
    const cleanedHint =
      kind === "account" ? stripPaymentNoise(hint ?? "") : cleanSegment(hint ?? "");
    if (!cleanedHint) {
      continue;
    }

    for (const item of items) {
      const score = scoreEntityMatch(cleanedHint, item, kind);
      if (!best || score > best.score) {
        best = { item, score };
      }
    }
  }

  if (!best || best.score < threshold) {
    return null;
  }

  return best.item;
};

const normalizeTelegramText = (value: string) => {
  const rawLines = value
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) =>
      cleanSegment(line.replace(TELEGRAM_LINE_PREFIX_REGEX, "")),
    )
    .filter(Boolean);

  if (rawLines.length === 0) {
    return "";
  }

  const joiner = rawLines.every((line) => TELEGRAM_KEY_VALUE_LINE_REGEX.test(line))
    ? "; "
    : " ";

  return collapseWhitespace(rawLines.join(joiner));
};

const inferTelegramType = (
  text: string,
  parsedType: "expense" | "income",
): "expense" | "income" => {
  if (parsedType === "income") {
    return "income";
  }
  return INCOME_TEXT_REGEX.test(text) ? "income" : "expense";
};

const extractSegment = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const cleaned = cleanSegment(match[1]);
    if (cleaned) {
      return cleaned;
    }
  }
  return null;
};

const extractIncomeCounterparty = (text: string) =>
  extractSegment(text, [
    /\bfrom\s+(.+?)(?=\s+(?:to|into|via|using|through|on|for|category|cat|tags?|date)\b|$)/i,
  ]);

const extractIncomeAccountHint = (text: string) =>
  extractSegment(text, [
    /\b(?:to|into)\s+(.+?)(?=\s+(?:via|using|through|on|for|category|cat|tags?|date)\b|$)/i,
  ]);

const isWeakIncomeMerchant = (value: string | null) =>
  !value || WEAK_INCOME_MERCHANT_REGEX.test(normalizeLookupText(value));

const parseNumber = (raw: string | null | undefined) => {
  if (!raw) {
    return null;
  }
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
};

const extractIncomeAmount = (text: string) => {
  for (const pattern of INCOME_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    const amount = parseNumber(match?.[1]);
    if (amount) {
      return amount;
    }
  }
  return null;
};

export const parseTelegramMessage = ({
  text,
  categories,
  paymentMethods,
  accounts,
  now = new Date(),
}: {
  text: string;
  categories: ParserLookupItem[];
  paymentMethods: ParserLookupItem[];
  accounts: ParserLookupItem[];
  now?: Date;
}): ParsedTelegramMessage => {
  const normalizedText = normalizeTelegramText(text);
  const parsed = parseStructuredExpenseText({ text: normalizedText, now });
  const type = inferTelegramType(normalizedText, parsed.type);
  const amount =
    type === "income" ? extractIncomeAmount(normalizedText) ?? parsed.amount : parsed.amount;
  const incomeCounterparty = type === "income"
    ? extractIncomeCounterparty(normalizedText)
    : null;
  const incomeAccountHint = type === "income"
    ? extractIncomeAccountHint(normalizedText)
    : null;

  const category = resolveEntity(
    [parsed.categoryHint],
    categories.filter((category) => !category.type || category.type === type),
    "category",
  );
  const paymentMethod = resolveEntity(
    [parsed.paymentHint, parsed.paymentSegment, normalizedText],
    paymentMethods,
    "payment",
  );
  const account = resolveEntity(
    [
      incomeAccountHint,
      parsed.accountHint,
      parsed.accountSegment,
      parsed.paymentSegment,
    ],
    accounts,
    "account",
  );
  const merchant =
    type === "income" && isWeakIncomeMerchant(parsed.merchant)
      ? incomeCounterparty
      : parsed.merchant;
  const accountHint = incomeAccountHint ?? parsed.accountHint;

  return {
    amount,
    type,
    date: parsed.date,
    hasExplicitDate: parsed.hasExplicitDate,
    normalizedText,
    merchant,
    notes: parsed.notes,
    tags: parsed.tags,
    categoryHint: parsed.categoryHint,
    paymentHint: parsed.paymentHint,
    accountHint,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    paymentMethodId: paymentMethod?.id ?? null,
    paymentMethodName: paymentMethod?.name ?? null,
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
  };
};
