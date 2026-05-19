import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { TransactionRule } from "../types/finance";
import { applyRulesToTransaction } from "./rules";
import type {
  ImportDefaults,
  ImportLookups,
  ParsedImportRow,
} from "./transactionImport";

dayjs.extend(customParseFormat);

export type PdfStatementParsedLine = {
  date: string;
  amount: number;
  type: "expense" | "income";
  merchant: string;
  notes: string;
  paymentHint: string;
  accountHint: string;
  categoryHint: string;
  source: string;
};

export type PdfStatementLineResult = {
  lineNumber: number;
  raw: string;
  status: "parsed" | "failed";
  parsed: PdfStatementParsedLine | null;
  error?: string;
};

export type PdfStatementParseResult = {
  lines: PdfStatementLineResult[];
  validRows: ParsedImportRow[];
  summary: {
    total: number;
    parsed: number;
    failed: number;
  };
  metadata: {
    accountHint: string;
    extractedTextLength: number;
    statementProfile: StatementProfileId;
  };
};

type PdfTextToken =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "operator"; value: string };

type TextFragment = {
  x: number;
  y: number;
  text: string;
};

type AmountMatch = {
  start: number;
  end: number;
  raw: string;
  value: number;
  direction: "expense" | "income" | null;
  isStrong: boolean;
};

type StatementProfileId =
  | "generic"
  | "hdfc"
  | "icici"
  | "sbi"
  | "axis"
  | "amex";

type StatementProfile = {
  id: StatementProfileId;
  detectPatterns: RegExp[];
  ignorePatterns: RegExp[];
  defaultPaymentHint?: string;
};

const PDF_DATE_FORMATS = [
  "DD/MM/YYYY",
  "D/M/YYYY",
  "DD/MM/YY",
  "D/M/YY",
  "DD-MM-YYYY",
  "D-M-YYYY",
  "DD-MM-YY",
  "D-M-YY",
  "DD MMM YYYY",
  "D MMM YYYY",
  "DD MMM YY",
  "D MMM YY",
  "DD MMM",
  "D MMM",
  "DD-MMM-YYYY",
  "D-MMM-YYYY",
  "DD-MMM-YY",
  "D-MMM-YY",
  "DD-MMM",
  "D-MMM",
  "MMM D YYYY",
  "MMM DD YYYY",
  "MMM D",
  "MMM DD",
];

const GENERIC_IGNORE_PATTERNS = [
  /^page\s+\d+/i,
  /^statement\b/i,
  /\bstatement\b.*\baccount\b/i,
  /^account\b/i,
  /^opening balance\b/i,
  /^closing balance\b/i,
  /^available balance\b/i,
  /^ledger balance\b/i,
  /^total\b/i,
  /^generated on\b/i,
  /^this is a system generated/i,
  /^date\s+description\b/i,
  /^date\s+narration\b/i,
  /^date\s+particulars\b/i,
  /^date\s+remarks\b/i,
  /^txn date\b/i,
  /^tran date\b/i,
  /^transaction date\b/i,
  /^transaction reference\b/i,
  /^value date\b/i,
  /^particulars\b.*\bbalance\b/i,
  /^description of charge\b/i,
  /^date of charge\b/i,
];

const STATEMENT_PROFILES: StatementProfile[] = [
  {
    id: "hdfc",
    detectPatterns: [/\bhdfc\b/i],
    ignorePatterns: [
      /^statement of account\b/i,
      /^date\s+narration\b/i,
      /^narration\b.*closing balance\b/i,
    ],
  },
  {
    id: "icici",
    detectPatterns: [/\bicici\b/i],
    ignorePatterns: [
      /^sr\.?\s*no\.?/i,
      /^mode\*/i,
      /^date\s+particulars\b/i,
    ],
  },
  {
    id: "sbi",
    detectPatterns: [/\bstate bank of india\b/i, /\bsbi\b/i],
    ignorePatterns: [
      /^txn date\b/i,
      /^transaction reference\b/i,
      /^debit credit balance\b/i,
    ],
  },
  {
    id: "axis",
    detectPatterns: [/\baxis bank\b/i],
    ignorePatterns: [
      /^tran date\b/i,
      /^particulars\s+chq\b/i,
      /^debit\(dr\)\s+credit\(cr\)\b/i,
    ],
  },
  {
    id: "amex",
    detectPatterns: [/\bamerican express\b/i, /\bamex\b/i],
    ignorePatterns: [
      /^date of charge\b/i,
      /^description of charge\b/i,
      /^total new charges\b/i,
      /^fees and charges\b/i,
    ],
    defaultPaymentHint: "card",
  },
];

const CARD_STATEMENT_PATTERN =
  /\b(?:credit|debit)\s+card\b|\bcard statement\b|\bcardmember\b/i;

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

const detectStatementProfile = (text: string): StatementProfile => {
  const matchedProfile = STATEMENT_PROFILES.find((profile) =>
    profile.detectPatterns.some((pattern) => pattern.test(text)),
  );

  return (
    matchedProfile ?? {
      id: "generic",
      detectPatterns: [],
      ignorePatterns: [],
    }
  );
};

const indexOfBytes = (
  data: Uint8Array,
  pattern: Uint8Array,
  start = 0,
): number => {
  outer: for (let i = start; i <= data.length - pattern.length; i += 1) {
    for (let j = 0; j < pattern.length; j += 1) {
      if (data[i + j] !== pattern[j]) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
};

const pdfKeyword = (value: string) =>
  new TextEncoder().encode(value);

const STREAM = pdfKeyword("stream");
const ENDSTREAM = pdfKeyword("endstream");
const LATIN1_DECODER = new TextDecoder("latin1");

const trimStreamData = (data: Uint8Array) => {
  let start = 0;
  let end = data.length;
  if (data[start] === 0x0d && data[start + 1] === 0x0a) {
    start += 2;
  } else if (data[start] === 0x0a) {
    start += 1;
  }
  if (data[end - 2] === 0x0d && data[end - 1] === 0x0a) {
    end -= 2;
  } else if (data[end - 1] === 0x0a) {
    end -= 1;
  }
  return data.slice(start, end);
};

const inflatePdfStream = async (data: Uint8Array) => {
  if (typeof DecompressionStream !== "undefined") {
    const blobBytes = new Uint8Array(data.byteLength);
    blobBytes.set(data);
    const stream = new Blob([blobBytes]).stream().pipeThrough(
      new DecompressionStream("deflate"),
    );
    const buffer = await new Response(stream).arrayBuffer();
    return LATIN1_DECODER.decode(buffer);
  }

  return "";
};

const decodePdfLiteralString = (input: string) => {
  let result = "";
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char !== "\\") {
      result += char;
      continue;
    }

    const next = input[i + 1] ?? "";
    if (next === "n") {
      result += "\n";
      i += 1;
      continue;
    }
    if (next === "r") {
      result += "\r";
      i += 1;
      continue;
    }
    if (next === "t") {
      result += "\t";
      i += 1;
      continue;
    }
    if (next === "b") {
      result += "\b";
      i += 1;
      continue;
    }
    if (next === "f") {
      result += "\f";
      i += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      const octal = input.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] ?? "";
      if (octal) {
        result += String.fromCharCode(Number.parseInt(octal, 8));
        i += octal.length;
        continue;
      }
    }
    if (next) {
      result += next;
      i += 1;
    }
  }
  return result;
};

const decodePdfHexString = (input: string) => {
  const normalized = input.replace(/\s+/g, "");
  const padded =
    normalized.length % 2 === 0 ? normalized : `${normalized}0`;
  const bytes = new Uint8Array(
    padded.match(/.{2}/g)?.map((chunk) => Number.parseInt(chunk, 16)) ?? [],
  );

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + 2);
    let output = "";
    for (let offset = 0; offset < view.byteLength; offset += 2) {
      output += String.fromCharCode(view.getUint16(offset));
    }
    return output;
  }

  return new TextDecoder().decode(bytes);
};

const readLiteralString = (content: string, start: number) => {
  let depth = 0;
  let result = "";
  let index = start;

  while (index < content.length) {
    const char = content[index];
    if (char === "(" && content[index - 1] !== "\\") {
      depth += 1;
      if (depth > 1) {
        result += char;
      }
      index += 1;
      continue;
    }
    if (char === ")" && content[index - 1] !== "\\") {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        break;
      }
      result += ")";
      continue;
    }
    result += char;
    index += 1;
  }

  return {
    value: decodePdfLiteralString(result),
    end: index,
  };
};

const readHexString = (content: string, start: number) => {
  const end = content.indexOf(">", start + 1);
  if (end === -1) {
    return { value: "", end: start + 1 };
  }
  return {
    value: decodePdfHexString(content.slice(start + 1, end)),
    end: end + 1,
  };
};

const readArrayText = (content: string, start: number) => {
  let index = start + 1;
  let text = "";

  while (index < content.length) {
    const char = content[index];
    if (char === "]") {
      return { value: text, end: index + 1 };
    }
    if (char === "(") {
      const literal = readLiteralString(content, index);
      text += literal.value;
      index = literal.end;
      continue;
    }
    if (char === "<" && content[index + 1] !== "<") {
      const hex = readHexString(content, index);
      text += hex.value;
      index = hex.end;
      continue;
    }
    index += 1;
  }

  return { value: text, end: index };
};

const tokenizePdfContent = (content: string): PdfTextToken[] => {
  const tokens: PdfTextToken[] = [];

  for (let index = 0; index < content.length; ) {
    const char = content[index];

    if (char === "%") {
      const nextLine = content.indexOf("\n", index);
      index = nextLine === -1 ? content.length : nextLine + 1;
      continue;
    }

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "(") {
      const literal = readLiteralString(content, index);
      if (literal.value.trim()) {
        tokens.push({ kind: "text", value: literal.value });
      }
      index = literal.end;
      continue;
    }

    if (char === "[") {
      const arrayText = readArrayText(content, index);
      if (arrayText.value.trim()) {
        tokens.push({ kind: "text", value: arrayText.value });
      }
      index = arrayText.end;
      continue;
    }

    if (char === "<" && content[index + 1] !== "<") {
      const hex = readHexString(content, index);
      if (hex.value.trim()) {
        tokens.push({ kind: "text", value: hex.value });
      }
      index = hex.end;
      continue;
    }

    if (char === "'" || char === "\"") {
      tokens.push({ kind: "operator", value: char });
      index += 1;
      continue;
    }

    const numberMatch = content
      .slice(index)
      .match(/^[+-]?(?:\d+\.\d+|\d+|\.\d+)/);
    if (numberMatch) {
      tokens.push({
        kind: "number",
        value: Number(numberMatch[0]),
      });
      index += numberMatch[0].length;
      continue;
    }

    const operatorMatch = content.slice(index).match(/^[A-Za-z*]{1,3}/);
    if (operatorMatch) {
      tokens.push({ kind: "operator", value: operatorMatch[0] });
      index += operatorMatch[0].length;
      continue;
    }

    index += 1;
  }

  return tokens;
};

const extractTextFromStreamContent = (content: string) => {
  const fragments: TextFragment[] = [];
  const operandStack: Array<number | string> = [];
  let currentX = 0;
  let currentY = 0;

  const pushText = (text: string) => {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return;
    }
    fragments.push({ x: currentX, y: currentY, text: cleaned });
  };

  tokenizePdfContent(content).forEach((token) => {
    if (token.kind === "number" || token.kind === "text") {
      operandStack.push(token.value);
      return;
    }

    const values = [...operandStack];
    operandStack.length = 0;

    switch (token.value) {
      case "Tm": {
        if (values.length >= 6) {
          currentX = Number(values[values.length - 2]) || 0;
          currentY = Number(values[values.length - 1]) || 0;
        }
        break;
      }
      case "Td":
      case "TD": {
        if (values.length >= 2) {
          currentX += Number(values[values.length - 2]) || 0;
          currentY += Number(values[values.length - 1]) || 0;
        }
        break;
      }
      case "T*": {
        currentY -= 12;
        currentX = 0;
        break;
      }
      case "Tj":
      case "TJ":
      case "'":
      case "\"": {
        const text = [...values]
          .reverse()
          .find((value): value is string => typeof value === "string");
        if (text) {
          pushText(text);
        }
        if (token.value === "'" || token.value === "\"") {
          currentY -= 12;
          currentX = 0;
        }
        break;
      }
      default:
        break;
    }
  });

  const grouped = new Map<string, TextFragment[]>();
  fragments.forEach((fragment) => {
    const lineKey = String(Math.round(fragment.y / 4) * 4);
    const line = grouped.get(lineKey) ?? [];
    line.push(fragment);
    grouped.set(lineKey, line);
  });

  return Array.from(grouped.entries())
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .map(([, line]) =>
      line
        .sort((left, right) => left.x - right.x)
        .map((fragment) => fragment.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
};

const normalizeExtractedText = (text: string) =>
  text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();

export const extractTextFromPdfArrayBuffer = async (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const lines: string[] = [];
  let cursor = 0;

  while (cursor < bytes.length) {
    const streamStart = indexOfBytes(bytes, STREAM, cursor);
    if (streamStart === -1) {
      break;
    }

    const streamEnd = indexOfBytes(bytes, ENDSTREAM, streamStart + STREAM.length);
    if (streamEnd === -1) {
      break;
    }

    const headerStart = Math.max(0, streamStart - 300);
    const headerText = LATIN1_DECODER.decode(bytes.slice(headerStart, streamStart));
    const rawStream = trimStreamData(
      bytes.slice(streamStart + STREAM.length, streamEnd),
    );

    let streamText = "";
    if (/\/FlateDecode/i.test(headerText)) {
      streamText = await inflatePdfStream(rawStream);
    } else {
      streamText = LATIN1_DECODER.decode(rawStream);
    }

    if (streamText.includes("BT")) {
      lines.push(...extractTextFromStreamContent(streamText));
    }

    cursor = streamEnd + ENDSTREAM.length;
  }

  return normalizeExtractedText(lines.join("\n"));
};

const extractStatementYear = (text: string) => {
  const years = Array.from(text.matchAll(/\b(20\d{2})\b/g))
    .map((match) => Number(match[1]))
    .filter((year) => year >= 2000 && year <= 2100);

  if (years.length === 0) {
    return dayjs().year();
  }

  const counts = new Map<number, number>();
  years.forEach((year) => {
    counts.set(year, (counts.get(year) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0][0];
};

const extractStatementAccountHint = (text: string) => {
  const patterns = [
    /(?:a\/c|account|acct)\s*(?:no\.?|number|ending|ending with)?\s*[:#-]?\s*(?:xx|x{2,})?\s*([0-9]{4,6})/i,
    /(?:card|credit card|debit card)\s*(?:ending|ending with|xx)?\s*[:#-]?\s*(?:xx|x{2,})?\s*([0-9]{4,6})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return "";
};

const cleanStatementLine = (line: string) =>
  line
    .replace(/\s+/g, " ")
    .replace(/[|•]/g, " ")
    .trim();

const shouldIgnoreStatementLine = (
  line: string,
  profile: StatementProfile,
) => {
  if (!line) {
    return true;
  }

  return [...GENERIC_IGNORE_PATTERNS, ...profile.ignorePatterns].some(
    (pattern) => pattern.test(line),
  );
};

const DATE_PREFIX_PATTERNS = [
  /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+/,
  /^(\d{1,2}(?:[-\s])[A-Za-z]{3,9}(?:(?:[-\s])\d{2,4})?)\s+/,
  /^([A-Za-z]{3,9}(?:[-\s])\d{1,2},?(?:(?:[-\s])\d{2,4})?)\s+/,
];

const stitchStatementLines = (text: string, profile: StatementProfile) => {
  const lines = text
    .split(/\n+/)
    .map(cleanStatementLine)
    .filter((line) => !shouldIgnoreStatementLine(line, profile));

  const stitched: string[] = [];
  let current = "";

  lines.forEach((line) => {
    const startsWithDate = DATE_PREFIX_PATTERNS.some((pattern) => pattern.test(line));
    if (startsWithDate) {
      if (current) {
        stitched.push(current);
      }
      current = line;
      return;
    }

    if (!current) {
      return;
    }

    current = `${current} ${line}`.replace(/\s+/g, " ").trim();
  });

  if (current) {
    stitched.push(current);
  }

  return stitched;
};

const parseStatementDate = (raw: string, inferredYear: number) => {
  const normalized = raw.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  const variants = Array.from(
    new Set([normalized, normalized.replace(/-/g, " ")]),
  );

  for (const variant of variants) {
    const parsed = dayjs(variant, PDF_DATE_FORMATS, true);
    if (parsed.isValid()) {
      const nextYear =
        parsed.year() < 2000 ? parsed.year(inferredYear) : parsed;
      return nextYear.format("YYYY-MM-DD");
    }
  }

  for (const variant of variants) {
    const withYear = dayjs(`${variant} ${inferredYear}`, [
      "DD/MM YYYY",
      "D/M YYYY",
      "DD-MM YYYY",
      "D-M YYYY",
      "DD MMM YYYY",
      "D MMM YYYY",
      "DD-MMM YYYY",
      "D-MMM YYYY",
      "MMM D YYYY",
      "MMM DD YYYY",
    ]);
    if (withYear.isValid()) {
      return withYear.format("YYYY-MM-DD");
    }
  }

  return null;
};

const parseAmountValue = (raw: string) => {
  const cleaned = raw
    .replace(/(?:₹|rs\.?|inr)/gi, "")
    .replace(/,/g, "")
    .replace(/\s*(?:cr|dr)\s*$/i, "")
    .trim();
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

const extractAmountMatches = (text: string): AmountMatch[] => {
  const matches: AmountMatch[] = [];
  const pattern =
    /(?:₹|rs\.?|inr)?\s*-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?:\s*(?:cr|dr))?/gi;

  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const leadingTrim = raw.length - raw.trimStart().length;
    const trailingTrim = raw.length - raw.trimEnd().length;
    const normalizedRaw = raw.trim();
    const significantStart = start + leadingTrim;
    const significantEnd = start + raw.length - trailingTrim;
    const prev = significantStart > 0 ? text[significantStart - 1] : " ";
    const next = significantEnd < text.length ? text[significantEnd] : " ";
    if (/[A-Za-z0-9/@]/.test(prev) || /[A-Za-z/@]/.test(next)) {
      continue;
    }

    const parsed = parseAmountValue(normalizedRaw);
    if (parsed === null) {
      continue;
    }

    const hasDecimal = /\.\d{1,2}\b/.test(normalizedRaw);
    const hasCurrency = /₹|rs\.?|inr/i.test(normalizedRaw);
    const hasComma = /,/.test(normalizedRaw);
    const digitCount = normalizedRaw.replace(/\D/g, "").length;
    const direction = /\bcr\b/i.test(normalizedRaw)
      ? "income"
      : /\bdr\b/i.test(normalizedRaw)
      ? "expense"
      : null;
    const isStrong = hasDecimal || hasCurrency || hasComma || direction !== null;
    const nearLineEnd = text.length - significantEnd <= 18;

    if (!hasDecimal && !hasCurrency && !hasComma && digitCount < 3) {
      continue;
    }

    if (!isStrong && !nearLineEnd) {
      continue;
    }

    matches.push({
      start: significantStart,
      end: significantEnd,
      raw: normalizedRaw,
      value: parsed,
      direction,
      isStrong,
    });
  }

  return matches;
};

const collectTrailingAmountCluster = (text: string, matches: AmountMatch[]) => {
  if (matches.length === 0) {
    return [];
  }

  const sourceMatches = matches.some((match) => match.isStrong)
    ? matches.filter((match) => match.isStrong)
    : matches;

  if (sourceMatches.length === 0) {
    return [];
  }

  const cluster: AmountMatch[] = [sourceMatches[sourceMatches.length - 1]];
  for (let index = sourceMatches.length - 2; index >= 0; index -= 1) {
    const candidate = sourceMatches[index];
    const gap = text.slice(candidate.end, cluster[0].start);
    if (/^\s+$/.test(gap)) {
      cluster.unshift(candidate);
      continue;
    }
    break;
  }

  return cluster;
};

const inferLineTypeFromText = (
  line: string,
  fallback: "expense" | "income",
): "expense" | "income" => {
  const normalized = line.toLowerCase();

  if (
    /\b(cr|credit|salary|refund|cashback|interest|deposit|received)\b/.test(
      normalized,
    ) &&
    !/\b(dr|debit|withdraw|purchase|spent|pos|ecom)\b/.test(normalized)
  ) {
    return "income";
  }

  if (
    /\b(dr|debit|withdraw|purchase|spent|atm|pos|ecom|upi to|bill)\b/.test(
      normalized,
    )
  ) {
    return "expense";
  }

  return fallback;
};

const inferPaymentHint = (
  description: string,
  profile: StatementProfile,
  preferCardPayment: boolean,
) => {
  const normalized = description.toLowerCase();
  if (/\bupi\b|@/.test(normalized)) {
    return "upi";
  }
  if (
    /\b(imps|neft|rtgs|bank transfer|nach|ach|ecs|autopay|standing instruction)\b/.test(
      normalized,
    )
  ) {
    return "bank transfer";
  }
  if (/\b(card|pos|ecom|visa|mastercard|rupay|amex)\b/.test(normalized)) {
    return "card";
  }
  if (/\b(atm|cash)\b/.test(normalized)) {
    return "cash";
  }
  if (preferCardPayment) {
    return profile.defaultPaymentHint ?? "card";
  }
  return profile.defaultPaymentHint ?? "";
};

const cleanupStatementDescription = (description: string) =>
  description
    .replace(
      /\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?=\s+(?:₹|rs\.?|inr|-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?))/gi,
      "",
    )
    .replace(
      /\s+\d{1,2}(?:[-\s])[A-Za-z]{3,9}(?:(?:[-\s])\d{2,4})?(?=\s+(?:₹|rs\.?|inr|-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?))/gi,
      "",
    )
    .replace(
      /\s+[A-Za-z]{3,9}(?:[-\s])\d{1,2},?(?:(?:[-\s])\d{2,4})?(?=\s+(?:₹|rs\.?|inr|-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?))/gi,
      "",
    )
    .replace(/\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/i, "")
    .replace(
      /\s+\d{1,2}(?:[-\s])[A-Za-z]{3,9}(?:(?:[-\s])\d{2,4})?$/i,
      "",
    )
    .replace(
      /\s+[A-Za-z]{3,9}(?:[-\s])\d{1,2},?(?:(?:[-\s])\d{2,4})?$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/[-:|]+$/g, "")
    .trim();

const parseStatementLine = ({
  raw,
  inferredYear,
  accountHint,
  defaultType,
  profile,
  preferCardPayment,
}: {
  raw: string;
  inferredYear: number;
  accountHint: string;
  defaultType: "expense" | "income";
  profile: StatementProfile;
  preferCardPayment: boolean;
}): PdfStatementParsedLine | null => {
  const dateMatch = DATE_PREFIX_PATTERNS.map((pattern) => raw.match(pattern)).find(
    Boolean,
  );
  if (!dateMatch) {
    return null;
  }

  const rawDate = dateMatch[1];
  const date = parseStatementDate(rawDate, inferredYear);
  if (!date) {
    return null;
  }

  const remainder = raw.slice(dateMatch[0].length).replace(/\s+/g, " ").trim();
  const amounts = extractAmountMatches(remainder);
  const candidateAmounts = collectTrailingAmountCluster(remainder, amounts);
  if (candidateAmounts.length === 0) {
    return null;
  }

  let amountCandidate: AmountMatch;
  if (candidateAmounts.some((item) => item.direction)) {
    amountCandidate =
      candidateAmounts.find((item) => item.direction !== null) ??
      candidateAmounts[0];
  } else if (candidateAmounts.length >= 3) {
    const trailing = candidateAmounts.slice(-3);
    if (trailing[0].value === 0 && trailing[1].value > 0) {
      amountCandidate = trailing[1];
    } else if (trailing[1].value === 0 && trailing[0].value > 0) {
      amountCandidate = trailing[0];
    } else {
      amountCandidate = trailing[0];
    }
  } else if (candidateAmounts.length >= 2) {
    amountCandidate = candidateAmounts[candidateAmounts.length - 2];
  } else {
    amountCandidate = candidateAmounts[0];
  }

  const description = cleanupStatementDescription(
    remainder
      .slice(0, amountCandidate.start)
      .replace(/\s+/g, " ")
      .trim(),
  );

  if (!description) {
    return null;
  }

  const type =
    amountCandidate.direction ??
    (candidateAmounts.length >= 3 &&
    amountCandidate === candidateAmounts.slice(-3)[1]
      ? "income"
      : null) ??
    inferLineTypeFromText(remainder, defaultType);

  return {
    date,
    amount: Math.abs(amountCandidate.value),
    type,
    merchant: description,
    notes: "",
    paymentHint: inferPaymentHint(description, profile, preferCardPayment),
    accountHint,
    categoryHint: "",
    source: "pdf-statement",
  };
};

export const parsePdfStatementText = ({
  text,
  defaults,
  lookups,
  rules = [],
}: {
  text: string;
  defaults: ImportDefaults;
  lookups: ImportLookups;
  rules?: TransactionRule[];
}): PdfStatementParseResult => {
  const normalizedText = normalizeExtractedText(text);
  const statementProfile = detectStatementProfile(normalizedText);
  const preferCardPayment =
    CARD_STATEMENT_PATTERN.test(normalizedText) ||
    statementProfile.defaultPaymentHint === "card";
  const inferredYear = extractStatementYear(normalizedText);
  const accountHint = extractStatementAccountHint(normalizedText);
  const rawLines = stitchStatementLines(normalizedText, statementProfile);
  const lines: PdfStatementLineResult[] = [];
  const validRows: ParsedImportRow[] = [];

  let parsed = 0;
  let failed = 0;

  rawLines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const parsedLine = parseStatementLine({
      raw,
      inferredYear,
      accountHint,
      defaultType: defaults.defaultType,
      profile: statementProfile,
      preferCardPayment,
    });

    if (!parsedLine) {
      lines.push({
        lineNumber,
        raw,
        status: "failed",
        parsed: null,
        error: "Could not identify a dated statement row with an amount.",
      });
      failed += 1;
      return;
    }

    parsed += 1;
    lines.push({
      lineNumber,
      raw,
      status: "parsed",
      parsed: parsedLine,
    });

    const ruleResult = applyRulesToTransaction(
      {
        merchant: parsedLine.merchant || null,
        notes: parsedLine.notes || null,
        type: parsedLine.type,
        category_id: null,
        tags: [],
      },
      rules,
    );

    let categoryId = ruleResult.category_id || defaults.defaultCategoryId || null;
    let categoryLabel = "Uncategorized";
    if (categoryId) {
      categoryLabel = lookups.categoryById.get(categoryId) ?? "Default category";
    }

    let paymentId = defaults.defaultPaymentId || null;
    let paymentLabel = "Unspecified";
    const resolvedPayment = resolveHintLookup({
      hint: parsedLine.paymentHint,
      byName: lookups.paymentByName,
      byId: lookups.paymentById,
    });
    if (resolvedPayment) {
      paymentId = resolvedPayment.id;
      paymentLabel = resolvedPayment.name;
    } else if (paymentId) {
      paymentLabel = lookups.paymentById.get(paymentId) ?? "Default payment";
    }

    let accountId = defaults.defaultAccountId || null;
    let accountLabel = "Unspecified";
    const resolvedAccount = resolveHintLookup({
      hint: parsedLine.accountHint,
      byName: lookups.accountByName,
      byId: lookups.accountById,
    });
    if (resolvedAccount) {
      accountId = resolvedAccount.id;
      accountLabel = resolvedAccount.name;
    } else if (accountId) {
      accountLabel = lookups.accountById.get(accountId) ?? "Default account";
    }

    validRows.push({
      rowNumber: lineNumber,
      data: {
        type: parsedLine.type,
        date: parsedLine.date,
        amount: parsedLine.amount,
        category_id: categoryId,
        payment_method_id: paymentId,
        account_id: accountId,
        merchant: (ruleResult.merchant ?? parsedLine.merchant) || null,
        notes: parsedLine.notes || null,
        tags: ruleResult.tags,
        is_recurring: defaults.recurring,
      },
      preview: {
        date: parsedLine.date,
        type: parsedLine.type,
        amount: parsedLine.amount,
        category: categoryLabel,
        payment: paymentLabel,
        account: accountLabel,
        merchant: (ruleResult.merchant ?? parsedLine.merchant) || "-",
        notes: parsedLine.notes || "-",
        tags: ruleResult.tags.length > 0 ? ruleResult.tags.join(", ") : "-",
      },
      warnings: [],
    });
  });

  return {
    lines,
    validRows,
    summary: {
      total: rawLines.length,
      parsed,
      failed,
    },
    metadata: {
      accountHint,
      extractedTextLength: normalizedText.length,
      statementProfile: statementProfile.id,
    },
  };
};
