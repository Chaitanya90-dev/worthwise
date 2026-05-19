import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { TransactionRule } from "../types/finance";
import { applyRulesToTransaction } from "./rules";

dayjs.extend(customParseFormat);

export type CsvMapping = {
  date: string;
  amount: string;
  debit: string;
  credit: string;
  type: string;
  category: string;
  payment: string;
  account: string;
  merchant: string;
  notes: string;
  tags: string;
};

export type CsvTemplate = {
  id: string;
  label: string;
  description: string;
  headerMap: Partial<Record<keyof CsvMapping, string[]>>;
  defaults?: Partial<ImportDefaults>;
};

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

export type ParsedImportRow = {
  rowNumber: number;
  data: {
    type: "expense" | "income";
    date: string;
    amount: number;
    category_id: string | null;
    payment_method_id: string | null;
    account_id: string | null;
    merchant?: string | null;
    notes?: string | null;
    tags?: string[];
    is_recurring: boolean;
  };
  preview: {
    date: string;
    type: "expense" | "income";
    amount: number;
    category: string;
    payment: string;
    account: string;
    merchant: string;
    notes: string;
    tags: string;
  };
  warnings: string[];
};

export type InvalidImportRow = {
  rowNumber: number;
  errors: string[];
  cells: string[];
};

export type ImportDefaults = {
  defaultType: "expense" | "income";
  defaultCategoryId: string;
  defaultPaymentId: string;
  defaultAccountId: string;
  recurring: boolean;
};

export type ImportLookups = {
  categoryByName: Map<string, string>;
  categoryById: Map<string, string>;
  paymentByName: Map<string, string>;
  paymentById: Map<string, string>;
  accountByName: Map<string, string>;
  accountById: Map<string, string>;
};

export type ParsedImportResult = {
  validRows: ParsedImportRow[];
  invalidRows: InvalidImportRow[];
  warnings: string[];
};

export const CSV_DELIMITERS = [
  { value: "auto", label: "Auto detect" },
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab (\\t)" },
  { value: "|", label: "Pipe (|)" },
];

export const CSV_TEMPLATES: CsvTemplate[] = [
  {
    id: "auto",
    label: "Auto detect",
    description: "Use header matching to map common columns.",
    headerMap: {},
  },
  {
    id: "axios",
    label: "Axios export",
    description:
      "Headers: date,time,place,amount_inr,dr_cr,account,expense,income,category,tags,note",
    headerMap: {
      date: ["date"],
      amount: ["amount_inr", "amount"],
      type: ["dr_cr", "drcr", "type"],
      debit: ["expense", "debit", "dr"],
      credit: ["income", "credit", "cr"],
      account: ["account", "account_name"],
      category: ["category"],
      merchant: ["place", "merchant", "payee", "store"],
      tags: ["tags", "tag"],
      notes: ["note", "notes", "remark", "description"],
      payment: ["payment", "payment_method", "channel"],
    },
  },
];

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "DD-MM-YYYY",
  "YYYY/MM/DD",
  "MMM D, YYYY",
  "D MMM YYYY",
];

const countDelimiter = (line: string, delimiter: string) => {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }
  return count;
};

const normalizeHeaderIndex = (headers: string[], patterns: string[]) => {
  const index = headers.findIndex((header) =>
    patterns.some((pattern) => header.includes(pattern))
  );
  return index >= 0 ? String(index) : "";
};

export const resolveTemplateMapping = (
  headers: string[],
  template: CsvTemplate
): Partial<CsvMapping> => {
  if (template.id === "auto") {
    return {};
  }
  const normalizedHeaders = headers.map((header) =>
    header.trim().toLowerCase()
  );
  const mapping: Partial<CsvMapping> = {};
  Object.entries(template.headerMap).forEach(([field, patterns]) => {
    if (!patterns || patterns.length === 0) {
      return;
    }
    const index = normalizeHeaderIndex(normalizedHeaders, patterns);
    if (index) {
      mapping[field as keyof CsvMapping] = index;
    }
  });
  return mapping;
};

export const createEmptyMapping = (): CsvMapping => ({
  date: "",
  amount: "",
  debit: "",
  credit: "",
  type: "",
  category: "",
  payment: "",
  account: "",
  merchant: "",
  notes: "",
  tags: "",
});

export const buildDefaultMapping = (headers: string[]) => {
  const lower = headers.map((header) => header.toLowerCase());
  return {
    ...createEmptyMapping(),
    date: normalizeHeaderIndex(lower, [
      "date",
      "transaction date",
      "value date",
      "posted",
    ]),
    amount: normalizeHeaderIndex(lower, ["amount", "amt", "value", "transaction"]),
    debit: normalizeHeaderIndex(lower, ["debit", "withdrawal", "dr", "expense"]),
    credit: normalizeHeaderIndex(lower, ["credit", "deposit", "cr", "income"]),
    type: normalizeHeaderIndex(lower, [
      "type",
      "txn type",
      "transaction type",
      "dr_cr",
      "dr/cr",
    ]),
    category: normalizeHeaderIndex(lower, ["category", "merchant category"]),
    payment: normalizeHeaderIndex(lower, ["payment", "method", "account", "card"]),
    account: normalizeHeaderIndex(lower, ["account name", "account", "card account"]),
    merchant: normalizeHeaderIndex(lower, [
      "merchant",
      "payee",
      "place",
      "vendor",
      "store",
      "counterparty",
    ]),
    notes: normalizeHeaderIndex(lower, [
      "description",
      "narration",
      "remarks",
      "note",
      "details",
    ]),
    tags: normalizeHeaderIndex(lower, ["tags", "tag", "labels"]),
  };
};

export const isMappingReady = (mapping: CsvMapping) =>
  Boolean(mapping.date) &&
  (Boolean(mapping.amount) || Boolean(mapping.debit) || Boolean(mapping.credit));

export const buildParsedCsv = (
  raw: string,
  delimiterSetting: string,
  hasHeader: boolean
): ParsedCsv => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { headers: [], rows: [], delimiter: "," };
  }

  const delimiter =
    delimiterSetting === "auto" ? detectDelimiter(raw) : delimiterSetting;
  const rawRows = parseCsv(raw, delimiter);
  const cleaned = rawRows.filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );

  if (cleaned.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const maxColumns = Math.max(...cleaned.map((row) => row.length));
  const columnLabels = Array.from({ length: maxColumns }, (_, index) => {
    const fallback = `Column ${index + 1}`;
    if (!hasHeader) {
      return fallback;
    }
    return cleaned[0][index]?.trim() || fallback;
  });

  return {
    headers: columnLabels,
    rows: hasHeader ? cleaned.slice(1) : cleaned,
    delimiter,
  };
};

export const parseCsv = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") {
        continue;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

export const detectDelimiter = (text: string) => {
  const line =
    text
      .split(/\r?\n/)
      .find((value) => value.trim().length > 0) ?? "";
  const delimiters = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  delimiters.forEach((delimiter) => {
    const count = countDelimiter(line, delimiter);
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });
  return best;
};

export const parseDateValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = dayjs(trimmed, DATE_FORMATS, true);
  if (parsed.isValid()) {
    return parsed.format("YYYY-MM-DD");
  }
  const fallback = dayjs(trimmed);
  return fallback.isValid() ? fallback.format("YYYY-MM-DD") : null;
};

export const parseAmountValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const isNegative =
    trimmed.includes("(") && trimmed.includes(")") && !trimmed.includes("-");
  const cleaned = trimmed.replace(/[^\d.-]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) {
    return null;
  }
  if (isNegative && parsed > 0) {
    return -parsed;
  }
  return parsed;
};

export const normalizeTypeValue = (
  value: string
): "expense" | "income" | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (
    ["expense", "debit", "dr", "withdrawal", "outflow", "paid"].some((token) =>
      trimmed.includes(token)
    )
  ) {
    return "expense";
  }
  if (
    ["income", "credit", "cr", "deposit", "inflow", "received"].some((token) =>
      trimmed.includes(token)
    )
  ) {
    return "income";
  }
  if (trimmed.startsWith("dr")) {
    return "expense";
  }
  if (trimmed.startsWith("cr")) {
    return "income";
  }
  return null;
};

export const splitTags = (value: string) =>
  value
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const buildHeaderLabels = (
  headers: string[],
  invalidRows: InvalidImportRow[]
) => {
  const maxColumns = Math.max(
    headers.length,
    ...invalidRows.map((row) => row.cells.length),
    0
  );
  return Array.from({ length: maxColumns }, (_, index) => {
    const label = headers[index]?.trim();
    return label || `Column ${index + 1}`;
  });
};

const escapeCsvValue = (value: string) => {
  if (!value) {
    return "";
  }
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(value) ? `"${escaped}"` : escaped;
};

export const buildInvalidRowsCsv = (
  headers: string[],
  invalidRows: InvalidImportRow[]
) => {
  if (invalidRows.length === 0) {
    return "";
  }

  const headerLabels = buildHeaderLabels(headers, invalidRows);
  const headerRow = ["Row", "Errors", ...headerLabels]
    .map(escapeCsvValue)
    .join(",");

  const rows = invalidRows.map((row) => {
    const cells = headerLabels.map((_, index) => row.cells[index] ?? "");
    return [String(row.rowNumber), row.errors.join("; "), ...cells]
      .map(escapeCsvValue)
      .join(",");
  });

  return [headerRow, ...rows].join("\n");
};

export const buildInvalidRowsJson = (
  headers: string[],
  invalidRows: InvalidImportRow[]
) => {
  const headerLabels = buildHeaderLabels(headers, invalidRows);
  const rows = invalidRows.map((row) => {
    const data: Record<string, string> = {};
    headerLabels.forEach((label, index) => {
      data[label] = row.cells[index] ?? "";
    });
    return {
      rowNumber: row.rowNumber,
      errors: row.errors,
      data,
    };
  });

  return JSON.stringify({ headers: headerLabels, rows }, null, 2);
};

export const parseImportRows = ({
  parsedCsv,
  mapping,
  hasHeader,
  defaults,
  lookups,
  rules = [],
}: {
  parsedCsv: ParsedCsv;
  mapping: CsvMapping;
  hasHeader: boolean;
  defaults: ImportDefaults;
  lookups: ImportLookups;
  rules?: TransactionRule[];
}): ParsedImportResult => {
  const validRows: ParsedImportRow[] = [];
  const invalidRows: InvalidImportRow[] = [];
  const warnings: string[] = [];

  if (!isMappingReady(mapping) || parsedCsv.rows.length === 0) {
    return { validRows, invalidRows, warnings };
  }

  parsedCsv.rows.forEach((cells, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    const rowWarnings: string[] = [];
    const errors: string[] = [];
    const getCell = (column: string) => {
      if (!column) {
        return "";
      }
      const idx = Number(column);
      if (Number.isNaN(idx)) {
        return "";
      }
      return (cells[idx] ?? "").trim();
    };

    const date = parseDateValue(getCell(mapping.date));
    if (!date) {
      errors.push("Invalid date");
    }

    const rawAmount = getCell(mapping.amount);
    const signedAmount = rawAmount ? parseAmountValue(rawAmount) : null;
    let inferredType: "expense" | "income" | null = null;
    if (signedAmount !== null) {
      inferredType = signedAmount < 0 ? "expense" : "income";
    }

    let amountValue: number | null = null;
    if (signedAmount !== null) {
      amountValue = Math.abs(signedAmount);
    }

    if (amountValue === null || amountValue === 0) {
      const debitValue = mapping.debit
        ? parseAmountValue(getCell(mapping.debit))
        : null;
      const creditValue = mapping.credit
        ? parseAmountValue(getCell(mapping.credit))
        : null;

      if (debitValue !== null || creditValue !== null) {
        if (
          debitValue !== null &&
          creditValue !== null &&
          debitValue !== 0 &&
          creditValue !== 0
        ) {
          rowWarnings.push("Both debit and credit present; using net amount.");
        }
        const debit = debitValue ?? 0;
        const credit = creditValue ?? 0;
        const net = credit - debit;
        if (net === 0) {
          errors.push("Amount is zero.");
        } else {
          inferredType = net < 0 ? "expense" : "income";
          amountValue = Math.abs(net);
        }
      }
    }

    if (!amountValue || amountValue <= 0) {
      errors.push("Invalid amount");
    }

    let type = mapping.type ? normalizeTypeValue(getCell(mapping.type)) : null;
    if (!type) {
      type = inferredType ?? defaults.defaultType;
    }

    const rawCategory = getCell(mapping.category);
    const normalizedCategory = rawCategory.trim().toLowerCase();
    let categoryId: string | null = null;
    let categoryLabel = "Uncategorized";
    if (rawCategory) {
      const matched = lookups.categoryByName.get(normalizedCategory);
      if (matched) {
        categoryId = matched;
        categoryLabel = lookups.categoryById.get(matched) ?? rawCategory;
      } else if (defaults.defaultCategoryId) {
        categoryId = defaults.defaultCategoryId;
        categoryLabel =
          lookups.categoryById.get(defaults.defaultCategoryId) ??
          "Default category";
        rowWarnings.push("Category not found; using default.");
      } else {
        rowWarnings.push("Category not found; left empty.");
        categoryLabel = rawCategory;
      }
    } else if (defaults.defaultCategoryId) {
      categoryId = defaults.defaultCategoryId;
      categoryLabel =
        lookups.categoryById.get(defaults.defaultCategoryId) ??
        "Default category";
    }

    const rawPayment = getCell(mapping.payment);
    const normalizedPayment = rawPayment.trim().toLowerCase();
    let paymentId: string | null = null;
    let paymentLabel = "Unspecified";
    if (rawPayment) {
      const matched = lookups.paymentByName.get(normalizedPayment);
      if (matched) {
        paymentId = matched;
        paymentLabel = lookups.paymentById.get(matched) ?? rawPayment;
      } else if (defaults.defaultPaymentId) {
        paymentId = defaults.defaultPaymentId;
        paymentLabel =
          lookups.paymentById.get(defaults.defaultPaymentId) ??
          "Default payment";
        rowWarnings.push("Payment method not found; using default.");
      } else {
        rowWarnings.push("Payment method not found; left empty.");
        paymentLabel = rawPayment;
      }
    } else if (defaults.defaultPaymentId) {
      paymentId = defaults.defaultPaymentId;
      paymentLabel =
        lookups.paymentById.get(defaults.defaultPaymentId) ??
        "Default payment";
    }

    const rawAccount = getCell(mapping.account);
    const normalizedAccount = rawAccount.trim().toLowerCase();
    let accountId: string | null = null;
    let accountLabel = "Unspecified";
    if (rawAccount) {
      const matched = lookups.accountByName.get(normalizedAccount);
      if (matched) {
        accountId = matched;
        accountLabel = lookups.accountById.get(matched) ?? rawAccount;
      } else if (defaults.defaultAccountId) {
        accountId = defaults.defaultAccountId;
        accountLabel =
          lookups.accountById.get(defaults.defaultAccountId) ??
          "Default account";
        rowWarnings.push("Account not found; using default.");
      } else {
        rowWarnings.push("Account not found; left empty.");
        accountLabel = rawAccount;
      }
    } else if (defaults.defaultAccountId) {
      accountId = defaults.defaultAccountId;
      accountLabel =
        lookups.accountById.get(defaults.defaultAccountId) ??
        "Default account";
    }

    const merchant = getCell(mapping.merchant);
    const notes = getCell(mapping.notes);
    let tags = mapping.tags ? splitTags(getCell(mapping.tags)) : [];

    if (errors.length > 0 || !type || !date || !amountValue) {
      invalidRows.push({
        rowNumber,
        errors,
        cells: cells.slice(),
      });
      return;
    }

    if (rowWarnings.length > 0) {
      warnings.push(`Row ${rowNumber}: ${rowWarnings.join(" ")}`);
    }

    const ruleResult = applyRulesToTransaction(
      {
        merchant: merchant.trim() ? merchant.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        type,
        category_id: categoryId,
        tags,
      },
      rules
    );

    if (ruleResult.category_id && ruleResult.category_id !== categoryId) {
      categoryId = ruleResult.category_id;
      categoryLabel =
        lookups.categoryById.get(ruleResult.category_id) ?? categoryLabel;
    }

    tags = ruleResult.tags;

    validRows.push({
      rowNumber,
      data: {
        type,
        date,
        amount: amountValue,
        category_id: categoryId,
        payment_method_id: paymentId,
        account_id: accountId,
        merchant: merchant.trim() ? merchant.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        tags,
        is_recurring: defaults.recurring,
      },
      preview: {
        date,
        type,
        amount: amountValue,
        category: categoryLabel,
        payment: paymentLabel,
        account: accountLabel,
        merchant: merchant.trim() || "-",
        notes: notes.trim() || "-",
        tags: tags.length > 0 ? tags.join(", ") : "-",
      },
      warnings: rowWarnings,
    });
  });

  return { validRows, invalidRows, warnings };
};
