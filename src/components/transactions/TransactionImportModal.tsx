import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  useAddTransactionMutation,
  useGetRulesQuery,
} from "../../features/api/apiSlice";
import {
  buildDefaultMapping,
  buildParsedCsv,
  buildInvalidRowsCsv,
  buildInvalidRowsJson,
  isMappingReady,
  normalizeTypeValue,
  parseAmountValue,
  parseImportRows,
  resolveTemplateMapping,
  CSV_TEMPLATES,
  type CsvMapping,
  type ParsedCsv,
  type ParsedImportRow,
} from "../../lib/transactionImport";
import {
  extractTextFromPdfArrayBuffer,
  parsePdfStatementText,
} from "../../lib/pdfStatementParser";
import { getBaseCurrency } from "../../lib/moneyConfig";
import { parseSmartText } from "../../lib/smartTextParser";
import type { Account, Category, PaymentMethod } from "../../types/finance";
import { supabase } from "../../lib/supabaseClient";
import { useAppDispatch } from "../../app/hooks";
import { apiSlice } from "../../features/api/apiSlice";
import { CsvInputSection } from "./import/CsvInputSection";
import { MappingSection } from "./import/MappingSection";
import { PdfInputSection } from "./import/PdfInputSection";
import { PreviewSection } from "./import/PreviewSection";
import { SmartPasteSection } from "./import/SmartPasteSection";

type ImportMode = "csv" | "smart" | "pdf";

type TransactionImportModalProps = {
  opened: boolean;
  onClose: () => void;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  title?: string;
  allowReferenceCreate?: boolean;
};

type ImportPreset = {
  mappingOverrides: Partial<CsvMapping>;
  defaults: {
    category: string;
    payment: string;
    account: string;
    type: "expense" | "income";
    recurring: boolean;
  };
};

const getCellValue = (cells: string[], column: string) => {
  if (!column) {
    return "";
  }
  const idx = Number(column);
  if (Number.isNaN(idx)) {
    return "";
  }
  return (cells[idx] ?? "").trim();
};

const collectColumnValues = (rows: string[][], column: string) => {
  if (!column) {
    return [];
  }
  const values = new Map<string, string>();
  rows.forEach((cells) => {
    const value = getCellValue(cells, column);
    if (!value) {
      return;
    }
    const key = value.trim().toLowerCase();
    if (!values.has(key)) {
      values.set(key, value.trim());
    }
  });
  return Array.from(values.entries()).map(([key, label]) => ({ key, label }));
};

const inferRowType = (
  cells: string[],
  mapping: CsvMapping,
  fallback: "expense" | "income",
) => {
  const explicit = mapping.type
    ? normalizeTypeValue(getCellValue(cells, mapping.type))
    : null;
  if (explicit) {
    return explicit;
  }

  if (mapping.amount) {
    const signed = parseAmountValue(getCellValue(cells, mapping.amount));
    if (signed !== null) {
      return signed < 0 ? "expense" : "income";
    }
  }

  const debit = mapping.debit
    ? parseAmountValue(getCellValue(cells, mapping.debit))
    : null;
  const credit = mapping.credit
    ? parseAmountValue(getCellValue(cells, mapping.credit))
    : null;
  if (debit !== null || credit !== null) {
    const net = (credit ?? 0) - (debit ?? 0);
    if (net !== 0) {
      return net < 0 ? "expense" : "income";
    }
  }

  return fallback;
};

const inferAccountType = (
  name: string,
  fallback: Account["type"],
): Account["type"] => {
  const lower = name.toLowerCase();
  if (lower.includes("cash")) {
    return "cash";
  }
  if (lower.includes("wallet")) {
    return "wallet";
  }
  if (
    lower.includes("card") ||
    lower.includes("cc") ||
    lower.includes("credit")
  ) {
    return "card";
  }
  return fallback;
};

const buildPresetKey = (accountId?: string | null) =>
  accountId ? `cashcove:importPreset:${accountId}` : "cashcove:importPreset";

const loadPresetFromStorage = (
  accountId?: string | null,
): ImportPreset | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(buildPresetKey(accountId));
    if (!raw) return null;
    return JSON.parse(raw) as ImportPreset;
  } catch {
    return null;
  }
};

export const TransactionImportModal = ({
  opened,
  onClose,
  categories,
  paymentMethods,
  accounts,
  title = "Import",
  allowReferenceCreate = false,
}: TransactionImportModalProps) => {
  const dispatch = useAppDispatch();
  const [importMode, setImportMode] = useState<ImportMode>("smart");
  const [smartRaw, setSmartRaw] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfRaw, setPdfRaw] = useState("");
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [preset, setPreset] = useState<ImportPreset | null>(() =>
    loadPresetFromStorage(),
  );
  const [importTemplateId, setImportTemplateId] = useState("auto");

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRaw, setImportRaw] = useState("");
  const [importHasHeader, setImportHasHeader] = useState(true);
  const [importDelimiter, setImportDelimiter] = useState("auto");
  const [importDefaultType, setImportDefaultType] = useState<
    "expense" | "income"
  >(() => preset?.defaults.type ?? "expense");
  const [importDefaultCategory, setImportDefaultCategory] = useState(
    () => preset?.defaults.category ?? "",
  );
  const [importDefaultPayment, setImportDefaultPayment] = useState(
    () => preset?.defaults.payment ?? "",
  );
  const [importDefaultAccount, setImportDefaultAccount] = useState(
    () => preset?.defaults.account ?? "",
  );
  const [importRecurring, setImportRecurring] = useState(
    () => preset?.defaults.recurring ?? false,
  );
  const [importDefaultTags, setImportDefaultTags] = useState("");
  const [importMappingOverrides, setImportMappingOverrides] = useState<
    Partial<CsvMapping>
  >(() => preset?.mappingOverrides ?? {});
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [createMissingPayments, setCreateMissingPayments] = useState(true);
  const [createMissingAccounts, setCreateMissingAccounts] = useState(true);
  const [newAccountType, setNewAccountType] = useState<Account["type"]>("bank");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    total: number;
    completed: number;
  } | null>(null);
  const [failedRows, setFailedRows] = useState<ParsedImportRow[]>([]);
  const [hasExportedErrors, setHasExportedErrors] = useState(false);
  const [rowOverrides, setRowOverrides] = useState<
    Record<
      number,
      Partial<ParsedImportRow["preview"] & ParsedImportRow["data"]>
    >
  >({});

  const [addTransaction] = useAddTransactionMutation();
  const { data: rules = [] } = useGetRulesQuery();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const categoryNameMap = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.name.trim().toLowerCase(),
          category.id,
        ]),
      ),
    [categories],
  );
  const paymentNameMap = useMemo(
    () =>
      new Map(
        paymentMethods.map((method) => [
          method.name.trim().toLowerCase(),
          method.id,
        ]),
      ),
    [paymentMethods],
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods],
  );
  const accountNameMap = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.name.trim().toLowerCase(),
          account.id,
        ]),
      ),
    [accounts],
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods],
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type}`,
      })),
    [accounts],
  );

  const parsedCsv = useMemo<ParsedCsv>(
    () => buildParsedCsv(importRaw, importDelimiter, importHasHeader),
    [importRaw, importDelimiter, importHasHeader],
  );

  const defaultMapping = useMemo(
    () => buildDefaultMapping(parsedCsv.headers),
    [parsedCsv.headers],
  );

  const effectiveMapping = useMemo(
    () => ({
      ...defaultMapping,
      ...importMappingOverrides,
    }),
    [defaultMapping, importMappingOverrides],
  );

  const mappingReady = isMappingReady(effectiveMapping);

  const parsedImport = useMemo(
    () =>
      parseImportRows({
        parsedCsv,
        mapping: effectiveMapping,
        hasHeader: importHasHeader,
        defaults: {
          defaultType: importDefaultType,
          defaultCategoryId: importDefaultCategory,
          defaultPaymentId: importDefaultPayment,
          defaultAccountId: importDefaultAccount,
          recurring: importRecurring,
        },
        lookups: {
          categoryByName: categoryNameMap,
          categoryById: categoryMap,
          paymentByName: paymentNameMap,
          paymentById: paymentMap,
          accountByName: accountNameMap,
          accountById: accountMap,
        },
        rules,
      }),
    [
      parsedCsv,
      effectiveMapping,
      importHasHeader,
      importDefaultType,
      importDefaultCategory,
      importDefaultPayment,
      importDefaultAccount,
      importRecurring,
      categoryNameMap,
      categoryMap,
      paymentNameMap,
      paymentMap,
      accountNameMap,
      accountMap,
      rules,
    ],
  );

  const missingReferences = useMemo(() => {
    if (!allowReferenceCreate) {
      return {
        categories: [] as Array<{
          key: string;
          label: string;
          type: "expense" | "income";
          conflict: boolean;
        }>,
        payments: [] as Array<{ key: string; label: string }>,
        accounts: [] as Array<{ key: string; label: string }>,
        categoryConflicts: [] as string[],
      };
    }

    const categoryCounts = new Map<
      string,
      { label: string; expense: number; income: number }
    >();

    parsedCsv.rows.forEach((cells) => {
      const rawCategory = getCellValue(cells, effectiveMapping.category);
      if (!rawCategory) {
        return;
      }
      const key = rawCategory.trim().toLowerCase();
      const entry = categoryCounts.get(key) ?? {
        label: rawCategory.trim(),
        expense: 0,
        income: 0,
      };
      const type = inferRowType(cells, effectiveMapping, importDefaultType);
      if (type === "income") {
        entry.income += 1;
      } else {
        entry.expense += 1;
      }
      categoryCounts.set(key, entry);
    });

    const categories = Array.from(categoryCounts.entries())
      .filter(([key]) => !categoryNameMap.has(key))
      .map(([key, entry]) => {
        const conflict = entry.expense > 0 && entry.income > 0;
        let resolvedType: "expense" | "income" = importDefaultType;
        if (entry.income > entry.expense) {
          resolvedType = "income";
        } else if (entry.expense > entry.income) {
          resolvedType = "expense";
        }
        return { key, label: entry.label, type: resolvedType, conflict };
      });

    const payments = collectColumnValues(
      parsedCsv.rows,
      effectiveMapping.payment,
    ).filter((item) => !paymentNameMap.has(item.key));
    const accounts = collectColumnValues(
      parsedCsv.rows,
      effectiveMapping.account,
    ).filter((item) => !accountNameMap.has(item.key));
    const categoryConflicts = categories
      .filter((item) => item.conflict)
      .map((item) => item.label);

    return { categories, payments, accounts, categoryConflicts };
  }, [
    allowReferenceCreate,
    parsedCsv.rows,
    effectiveMapping,
    importDefaultType,
    categoryNameMap,
    paymentNameMap,
    accountNameMap,
  ]);

  const missingTotal =
    missingReferences.categories.length +
    missingReferences.payments.length +
    missingReferences.accounts.length;
  const hasMissingReferences = missingTotal > 0;
  const accountTypeOptions: Array<{ value: Account["type"]; label: string }> = [
    { value: "bank", label: "Bank" },
    { value: "card", label: "Credit card" },
    { value: "wallet", label: "Wallet" },
    { value: "cash", label: "Cash" },
    { value: "other", label: "Other" },
  ];

  const clearImportFeedback = () => {
    setImportError(null);
    setImportResult(null);
    setFailedRows([]);
  };

  const savePreset = () => {
    try {
      const payload = {
        mappingOverrides: importMappingOverrides,
        defaults: {
          category: importDefaultCategory,
          payment: importDefaultPayment,
          account: importDefaultAccount,
          type: importDefaultType,
          recurring: importRecurring,
        },
      };
      const accountKey = buildPresetKey(importDefaultAccount || null);
      localStorage.setItem(accountKey, JSON.stringify(payload));
      localStorage.setItem(buildPresetKey(), JSON.stringify(payload));
      setPreset(payload);
    } catch {
      // ignore save errors
    }
  };

  const resetExportState = () => {
    setHasExportedErrors(false);
  };

  const resetFeedbackForInputChange = () => {
    clearImportFeedback();
    resetExportState();
    setRowOverrides({});
  };

  const resetMappingOverrides = () => {
    setImportMappingOverrides({});
  };

  const applyTemplateMapping = (
    headers: string[],
    templateId = importTemplateId,
  ) => {
    if (templateId === "auto") {
      setImportMappingOverrides({});
      return;
    }
    const template = CSV_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    setImportMappingOverrides(resolveTemplateMapping(headers, template));
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportRaw("");
    setSmartRaw("");
    setPdfFile(null);
    setPdfRaw("");
    setPdfExtracting(false);
    setImportHasHeader(true);
    setImportDelimiter("auto");
    setImportTemplateId("auto");
    setImportDefaultType(preset?.defaults.type ?? "expense");
    setImportDefaultCategory(preset?.defaults.category ?? "");
    setImportDefaultPayment(preset?.defaults.payment ?? "");
    setImportDefaultAccount(preset?.defaults.account ?? "");
    setImportRecurring(preset?.defaults.recurring ?? false);
    setImportMappingOverrides(preset?.mappingOverrides ?? {});
    setCreateMissingCategories(true);
    setCreateMissingPayments(true);
    setCreateMissingAccounts(true);
    setNewAccountType("bank");
    clearImportFeedback();
    resetExportState();
    setImportProgress(null);
    setRowOverrides({});
  };

  const handleClose = () => {
    resetImportState();
    onClose();
  };

  const handleImportFileChange = (file: File | null) => {
    setImportFile(file);
    if (!file) {
      setImportRaw("");
      resetMappingOverrides();
      resetFeedbackForInputChange();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setImportRaw(content);
      const nextParsed = buildParsedCsv(
        content,
        importDelimiter,
        importHasHeader,
      );
      applyTemplateMapping(nextParsed.headers);
    };
    reader.readAsText(file);
    setImportRaw("");
    resetMappingOverrides();
    resetFeedbackForInputChange();
  };

  const handleImportRawChange = (value: string) => {
    setImportRaw(value);
    if (importFile) {
      setImportFile(null);
    }
    resetMappingOverrides();
    const nextParsed = buildParsedCsv(value, importDelimiter, importHasHeader);
    applyTemplateMapping(nextParsed.headers);
    resetFeedbackForInputChange();
  };

  const handlePdfFileChange = async (file: File | null) => {
    setPdfFile(file);
    setPdfExtracting(false);
    if (!file) {
      setPdfRaw("");
      resetFeedbackForInputChange();
      return;
    }

    resetFeedbackForInputChange();
    setPdfExtracting(true);
    try {
      const buffer = await file.arrayBuffer();
      const extracted = await extractTextFromPdfArrayBuffer(buffer);
      setPdfRaw(extracted);
      if (!extracted.trim()) {
        setImportError(
          "No text could be extracted from this PDF. Try a text-based statement or paste copied statement text.",
        );
      }
    } catch {
      setPdfRaw("");
      setImportError(
        "Unable to read this PDF statement. Try another PDF or paste copied statement text.",
      );
    } finally {
      setPdfExtracting(false);
    }
  };

  const handlePdfRawChange = (value: string) => {
    setPdfRaw(value);
    clearImportFeedback();
    resetExportState();
    setRowOverrides({});
  };

  const handleImportDelimiterChange = (value: string | null) => {
    const nextDelimiter = value ?? "auto";
    setImportDelimiter(nextDelimiter);
    resetMappingOverrides();
    const nextParsed = buildParsedCsv(
      importRaw,
      nextDelimiter,
      importHasHeader,
    );
    applyTemplateMapping(nextParsed.headers);
    resetFeedbackForInputChange();
  };

  const handleImportHasHeaderChange = (checked: boolean) => {
    setImportHasHeader(checked);
    resetMappingOverrides();
    const nextParsed = buildParsedCsv(importRaw, importDelimiter, checked);
    applyTemplateMapping(nextParsed.headers);
    resetFeedbackForInputChange();
  };

  const handleImportDefaultTypeChange = (value: string | null) => {
    setImportDefaultType((value ?? "expense") as "expense" | "income");
    resetFeedbackForInputChange();
  };

  const handleImportDefaultCategoryChange = (value: string | null) => {
    setImportDefaultCategory(value ?? "");
    resetFeedbackForInputChange();
  };

  const handleImportDefaultPaymentChange = (value: string | null) => {
    setImportDefaultPayment(value ?? "");
    resetFeedbackForInputChange();
  };
  const handleImportDefaultTagsChange = (value: string) => {
    setImportDefaultTags(value);
    resetFeedbackForInputChange();
  };
  const handleImportDefaultAccountChange = (value: string | null) => {
    const nextAccount = value ?? "";
    setImportDefaultAccount(nextAccount);
    const accountPreset = loadPresetFromStorage(nextAccount || null);
    if (accountPreset) {
      setPreset(accountPreset);
      setImportTemplateId("auto");
      setImportDefaultType(accountPreset.defaults.type ?? "expense");
      setImportDefaultCategory(accountPreset.defaults.category ?? "");
      setImportDefaultPayment(accountPreset.defaults.payment ?? "");
      setImportRecurring(accountPreset.defaults.recurring ?? false);
      setImportMappingOverrides(accountPreset.mappingOverrides ?? {});
    }
    resetFeedbackForInputChange();
  };

  const handleImportRecurringChange = (checked: boolean) => {
    setImportRecurring(checked);
    resetFeedbackForInputChange();
  };

  const handleMappingChange = (
    field: keyof CsvMapping,
    value: string | null,
  ) => {
    setImportMappingOverrides((prev) => ({
      ...prev,
      [field]: value ?? "",
    }));
    resetFeedbackForInputChange();
  };

  const handleTemplateChange = (value: string | null) => {
    const nextTemplate = value ?? "auto";
    setImportTemplateId(nextTemplate);
    applyTemplateMapping(parsedCsv.headers, nextTemplate);
    resetFeedbackForInputChange();
  };

  const createMissingReferences = async () => {
    const created = {
      categories: [] as Category[],
      payments: [] as PaymentMethod[],
      accounts: [] as Account[],
    };

    if (createMissingCategories && missingReferences.categories.length > 0) {
      const { data, error } = await supabase
        .from("categories")
        .upsert(
          missingReferences.categories.map((item) => ({
            name: item.label,
            type: item.type,
            parent_id: null,
          })),
          { onConflict: "user_id,name,parent_id", ignoreDuplicates: true },
        )
        .select("id, name, parent_id, type");

      if (error) {
        throw new Error(`Unable to create categories: ${error.message}`);
      }

      created.categories = (data ?? []) as Category[];
    }

    if (createMissingPayments && missingReferences.payments.length > 0) {
      const { data, error } = await supabase
        .from("payment_methods")
        .upsert(
          missingReferences.payments.map((item) => ({ name: item.label })),
          { onConflict: "user_id,name", ignoreDuplicates: true },
        )
        .select("id, name");

      if (error) {
        throw new Error(`Unable to create payment methods: ${error.message}`);
      }

      created.payments = (data ?? []) as PaymentMethod[];
    }

    if (createMissingAccounts && missingReferences.accounts.length > 0) {
      const { data, error } = await supabase
        .from("accounts")
        .upsert(
          missingReferences.accounts.map((item) => ({
            name: item.label,
            type: inferAccountType(item.label, newAccountType),
            current_balance: 0,
            currency: getBaseCurrency(),
          })),
          { onConflict: "user_id,name", ignoreDuplicates: true },
        )
        .select("id, name, type, current_balance, currency");

      if (error) {
        throw new Error(`Unable to create accounts: ${error.message}`);
      }

      created.accounts = (data ?? []) as Account[];
    }

    if (
      created.categories.length > 0 ||
      created.payments.length > 0 ||
      created.accounts.length > 0
    ) {
      dispatch(
        apiSlice.util.invalidateTags([
          "Categories",
          "PaymentMethods",
          "Accounts",
        ]),
      );
    }

    return created;
  };

  const importRows = async (
    rows: ParsedImportRow[],
  ): Promise<{ success: number; failed: number }> => {
    const total = rows.length;
    setImportProgress({ total, completed: 0 });

    let success = 0;
    const failures: ParsedImportRow[] = [];

    for (const row of rows) {
      try {
        await addTransaction(row.data).unwrap();
        success += 1;
      } catch {
        failures.push(row);
      }
      setImportProgress({ total, completed: success + failures.length });
    }

    setImportProgress(null);
    setFailedRows(failures);
    setImportResult({
      success,
      failed: failures.length,
      errors: failures
        .slice(0, 5)
        .map((row) => `Row ${row.rowNumber}: failed to import.`),
    });

    return { success, failed: failures.length };
  };

  /* ─── Smart paste parse result ──────────────────── */

  const smartParseResult = useMemo(
    () =>
      parseSmartText({
        text: smartRaw,
        defaults: {
          defaultType: importDefaultType,
          defaultCategoryId: importDefaultCategory,
          defaultPaymentId: importDefaultPayment,
          defaultAccountId: importDefaultAccount,
          recurring: importRecurring,
        },
        lookups: {
          categoryByName: categoryNameMap,
          categoryById: categoryMap,
          paymentByName: paymentNameMap,
          paymentById: paymentMap,
          accountByName: accountNameMap,
          accountById: accountMap,
        },
        rules,
      }),
    [
      smartRaw,
      importDefaultType,
      importDefaultCategory,
      importDefaultPayment,
      importDefaultAccount,
      importRecurring,
      categoryNameMap,
      categoryMap,
      paymentNameMap,
      paymentMap,
      accountNameMap,
      accountMap,
      rules,
    ],
  );
  const pdfParseResult = useMemo(
    () =>
      parsePdfStatementText({
        text: pdfRaw,
        defaults: {
          defaultType: importDefaultType,
          defaultCategoryId: importDefaultCategory,
          defaultPaymentId: importDefaultPayment,
          defaultAccountId: importDefaultAccount,
          recurring: importRecurring,
        },
        lookups: {
          categoryByName: categoryNameMap,
          categoryById: categoryMap,
          paymentByName: paymentNameMap,
          paymentById: paymentMap,
          accountByName: accountNameMap,
          accountById: accountMap,
        },
        rules,
      }),
    [
      pdfRaw,
      importDefaultType,
      importDefaultCategory,
      importDefaultPayment,
      importDefaultAccount,
      importRecurring,
      categoryNameMap,
      categoryMap,
      paymentNameMap,
      paymentMap,
      accountNameMap,
      accountMap,
      rules,
    ],
  );
  const defaultTagList = useMemo(
    () =>
      importDefaultTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [importDefaultTags],
  );

  /* ─── Unified active rows ─────────────────────── */

  const activeValidRows = useMemo(() => {
    const baseRows =
      importMode === "smart"
        ? smartParseResult.validRows
        : importMode === "pdf"
        ? pdfParseResult.validRows
        : parsedImport.validRows;

    const rowsWithDefaults =
      importMode === "csv" || defaultTagList.length === 0
        ? baseRows
        : baseRows.map((row) => {
            const mergedTags = Array.from(
              new Set([...(row.data.tags ?? []), ...defaultTagList]),
            );
            return {
              ...row,
              data: {
                ...row.data,
                tags: mergedTags,
              },
              preview: {
                ...row.preview,
                tags: mergedTags.length > 0 ? mergedTags.join(", ") : "-",
              },
            };
          });

    if (Object.keys(rowOverrides).length === 0) {
      return rowsWithDefaults;
    }

    return rowsWithDefaults.map((row) => {
      const overrides = rowOverrides[row.rowNumber];
      if (!overrides) return row;

      return {
        ...row,
        data: {
          ...row.data,
          date: overrides.date ?? row.data.date,
          amount:
            overrides.amount !== undefined
              ? Number(overrides.amount)
              : row.data.amount,
          merchant: overrides.merchant ?? row.data.merchant,
          notes: overrides.notes ?? row.data.notes,
        },
        preview: {
          ...row.preview,
          date: overrides.date ?? row.preview.date,
          amount:
            overrides.amount !== undefined
              ? Number(overrides.amount)
              : row.preview.amount,
          merchant: overrides.merchant ?? row.preview.merchant,
          notes: overrides.notes ?? row.preview.notes,
        },
      };
    });
  }, [
    importMode,
    smartParseResult.validRows,
    pdfParseResult.validRows,
    parsedImport.validRows,
    defaultTagList,
    rowOverrides,
  ]);

  const activeInvalidRows =
    importMode === "csv" ? parsedImport.invalidRows : [];
  const activeWarnings = importMode === "csv" ? parsedImport.warnings : [];
  const activeRowCount =
    importMode === "smart"
      ? smartParseResult.summary.total
      : importMode === "pdf"
      ? pdfParseResult.summary.total
      : parsedCsv.rows.length;

  const handleImportTransactions = async () => {
    clearImportFeedback();

    if (importMode === "csv") {
      if (!mappingReady) {
        setImportError("Map at least the date and amount columns.");
        return;
      }

      if (parsedCsv.rows.length === 0) {
        setImportError("No rows to import.");
        return;
      }
    } else {
      const parsedRows =
        importMode === "smart"
          ? smartParseResult.validRows
          : pdfParseResult.validRows;
      const emptyMessage =
        importMode === "smart"
          ? "Paste some transaction text first."
          : "Upload a PDF or paste copied statement text first.";
      const failedMessage =
        importMode === "smart"
          ? "No transactions could be parsed. Try different text."
          : "No statement rows could be parsed. Try another PDF or clean up the pasted statement text.";
      if (parsedRows.length === 0) {
        setImportError(
          (importMode === "smart" ? smartRaw : pdfRaw).trim()
            ? failedMessage
            : emptyMessage,
        );
        return;
      }
    }

    let nextCategoryMap = categoryMap;
    let nextCategoryNameMap = categoryNameMap;
    let nextPaymentMap = paymentMap;
    let nextPaymentNameMap = paymentNameMap;
    let nextAccountMap = accountMap;
    let nextAccountNameMap = accountNameMap;

    if (importMode === "csv" && allowReferenceCreate && hasMissingReferences) {
      try {
        const created = await createMissingReferences();
        if (created.categories.length > 0) {
          nextCategoryMap = new Map(categoryMap);
          nextCategoryNameMap = new Map(categoryNameMap);
          created.categories.forEach((item) => {
            nextCategoryMap.set(item.id, item.name);
            nextCategoryNameMap.set(item.name.trim().toLowerCase(), item.id);
          });
        }
        if (created.payments.length > 0) {
          nextPaymentMap = new Map(paymentMap);
          nextPaymentNameMap = new Map(paymentNameMap);
          created.payments.forEach((item) => {
            nextPaymentMap.set(item.id, item.name);
            nextPaymentNameMap.set(item.name.trim().toLowerCase(), item.id);
          });
        }
        if (created.accounts.length > 0) {
          nextAccountMap = new Map(accountMap);
          nextAccountNameMap = new Map(accountNameMap);
          created.accounts.forEach((item) => {
            nextAccountMap.set(item.id, item.name);
            nextAccountNameMap.set(item.name.trim().toLowerCase(), item.id);
          });
        }
      } catch (err) {
        setImportError(
          err instanceof Error
            ? err.message
            : "Unable to create missing references.",
        );
        return;
      }
    }

    let rowsToImport: ParsedImportRow[];

    if (importMode === "smart" || importMode === "pdf") {
      rowsToImport = activeValidRows;
    } else {
      const parsed = parseImportRows({
        parsedCsv,
        mapping: effectiveMapping,
        hasHeader: importHasHeader,
        defaults: {
          defaultType: importDefaultType,
          defaultCategoryId: importDefaultCategory,
          defaultPaymentId: importDefaultPayment,
          defaultAccountId: importDefaultAccount,
          recurring: importRecurring,
        },
        lookups: {
          categoryByName: nextCategoryNameMap,
          categoryById: nextCategoryMap,
          paymentByName: nextPaymentNameMap,
          paymentById: nextPaymentMap,
          accountByName: nextAccountNameMap,
          accountById: nextAccountMap,
        },
        rules,
      });

      // Also apply inline edits to CSV imports upon final submit
      rowsToImport = parsed.validRows.map((row) => {
        const overrides = rowOverrides[row.rowNumber];
        if (!overrides) return row;
        return {
          ...row,
          data: {
            ...row.data,
            date: overrides.date ?? row.data.date,
            amount:
              overrides.amount !== undefined
                ? Number(overrides.amount)
                : row.data.amount,
            merchant: overrides.merchant ?? row.data.merchant,
            notes: overrides.notes ?? row.data.notes,
          },
        };
      });
    }

    if (rowsToImport.length === 0) {
      setImportError("No valid rows to import.");
      return;
    }

    const result = await importRows(rowsToImport);
    if (result.failed === 0 && result.success > 0) {
      savePreset();
      handleClose();
    }
  };

  const handleRetryFailedRows = async () => {
    if (failedRows.length === 0) {
      return;
    }
    const rowsToRetry = [...failedRows];
    clearImportFeedback();
    await importRows(rowsToRetry);
  };

  const handleRowEdit = (rowNumber: number, field: string, value: any) => {
    setRowOverrides((prev) => ({
      ...prev,
      [rowNumber]: {
        ...prev[rowNumber],
        [field]: value,
      },
    }));
  };

  const handleExportErrors = (format: "csv" | "json") => {
    if (parsedImport.invalidRows.length === 0) {
      return;
    }

    const content =
      format === "csv"
        ? buildInvalidRowsCsv(parsedCsv.headers, parsedImport.invalidRows)
        : buildInvalidRowsJson(parsedCsv.headers, parsedImport.invalidRows);

    if (!content) {
      return;
    }

    const mimeType =
      format === "csv" ? "text/csv;charset=utf-8;" : "application/json";
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sanchay-import-errors-${dayjs().format(
      "YYYYMMDD-HHmm",
    )}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    setHasExportedErrors(true);
  };

  const canRetryFailedRows =
    failedRows.length > 0 &&
    (parsedImport.invalidRows.length === 0 || hasExportedErrors);
  const showRetryHint =
    failedRows.length > 0 &&
    parsedImport.invalidRows.length > 0 &&
    !hasExportedErrors;

  const isSmartMode = importMode === "smart";
  const isPdfMode = importMode === "pdf";
  const canImport =
    importMode === "smart"
      ? smartParseResult.validRows.length > 0
      : importMode === "pdf"
      ? pdfParseResult.validRows.length > 0
      : mappingReady && parsedImport.validRows.length > 0;

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="xl">
      <Stack gap="md">
        <SegmentedControl
          value={importMode}
          onChange={(value) => {
            setImportMode(value as ImportMode);
            clearImportFeedback();
          }}
          data={[
            { value: "smart", label: "⚡ Smart paste" },
            { value: "pdf", label: "📕 PDF statement" },
            { value: "csv", label: "📄 CSV import" },
          ]}
          fullWidth
        />

        {isSmartMode ? (
          <>
            <SmartPasteSection
              smartRaw={smartRaw}
              onSmartRawChange={(value) => {
                setSmartRaw(value);
                resetFeedbackForInputChange();
              }}
              importDefaultType={importDefaultType}
              onDefaultTypeChange={handleImportDefaultTypeChange}
              importRecurring={importRecurring}
              importDefaultTags={importDefaultTags}
              onDefaultTagsChange={handleImportDefaultTagsChange}
              lines={smartParseResult.lines}
            />

            <Divider />

            <MappingSection
              headers={[]}
              effectiveMapping={effectiveMapping}
              categoryOptions={categoryOptions}
              paymentOptions={paymentOptions}
              accountOptions={accountOptions}
              importDefaultCategory={importDefaultCategory}
              importDefaultPayment={importDefaultPayment}
              importDefaultAccount={importDefaultAccount}
              importRecurring={importRecurring}
              onMappingChange={handleMappingChange}
              onDefaultCategoryChange={handleImportDefaultCategoryChange}
              onDefaultPaymentChange={handleImportDefaultPaymentChange}
              onDefaultAccountChange={handleImportDefaultAccountChange}
              onRecurringChange={handleImportRecurringChange}
              hideColumnMapping
            />
          </>
        ) : isPdfMode ? (
          <>
            <PdfInputSection
              pdfFile={pdfFile}
              pdfRaw={pdfRaw}
              pdfExtracting={pdfExtracting}
              importDefaultType={importDefaultType}
              importDefaultTags={importDefaultTags}
              lines={pdfParseResult.lines}
              onFileChange={handlePdfFileChange}
              onRawChange={handlePdfRawChange}
              onDefaultTypeChange={handleImportDefaultTypeChange}
              onDefaultTagsChange={handleImportDefaultTagsChange}
            />

            <Divider />

            <MappingSection
              headers={[]}
              effectiveMapping={effectiveMapping}
              categoryOptions={categoryOptions}
              paymentOptions={paymentOptions}
              accountOptions={accountOptions}
              importDefaultCategory={importDefaultCategory}
              importDefaultPayment={importDefaultPayment}
              importDefaultAccount={importDefaultAccount}
              importRecurring={importRecurring}
              onMappingChange={handleMappingChange}
              onDefaultCategoryChange={handleImportDefaultCategoryChange}
              onDefaultPaymentChange={handleImportDefaultPaymentChange}
              onDefaultAccountChange={handleImportDefaultAccountChange}
              onRecurringChange={handleImportRecurringChange}
              hideColumnMapping
            />
          </>
        ) : (
          <>
            <CsvInputSection
              importFile={importFile}
              importRaw={importRaw}
              importDelimiter={importDelimiter}
              importHasHeader={importHasHeader}
              importDefaultType={importDefaultType}
              importTemplateId={importTemplateId}
              templates={CSV_TEMPLATES}
              detectedDelimiter={parsedCsv.delimiter}
              onFileChange={handleImportFileChange}
              onRawChange={handleImportRawChange}
              onDelimiterChange={handleImportDelimiterChange}
              onHasHeaderChange={handleImportHasHeaderChange}
              onDefaultTypeChange={handleImportDefaultTypeChange}
              onTemplateChange={handleTemplateChange}
            />

            <Divider />

            <MappingSection
              headers={parsedCsv.headers}
              effectiveMapping={effectiveMapping}
              categoryOptions={categoryOptions}
              paymentOptions={paymentOptions}
              accountOptions={accountOptions}
              importDefaultCategory={importDefaultCategory}
              importDefaultPayment={importDefaultPayment}
              importDefaultAccount={importDefaultAccount}
              importRecurring={importRecurring}
              onMappingChange={handleMappingChange}
              onDefaultCategoryChange={handleImportDefaultCategoryChange}
              onDefaultPaymentChange={handleImportDefaultPaymentChange}
              onDefaultAccountChange={handleImportDefaultAccountChange}
              onRecurringChange={handleImportRecurringChange}
            />
          </>
        )}

        {allowReferenceCreate && importMode === "csv" ? (
          <>
            <Divider />
            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Stack gap={2}>
                    <Text fw={600}>Create missing references</Text>
                    <Text size="xs" c="dimmed">
                      Auto-create categories, payment methods, and accounts
                      found in the CSV.
                    </Text>
                  </Stack>
                  <Badge
                    variant="light"
                    color={hasMissingReferences ? "orange" : "teal"}
                  >
                    {hasMissingReferences
                      ? `${missingTotal} missing`
                      : "All set"}
                  </Badge>
                </Group>
                <Group gap="md" wrap="wrap">
                  <Switch
                    checked={createMissingCategories}
                    onChange={(event) =>
                      setCreateMissingCategories(event.currentTarget.checked)
                    }
                    disabled={missingReferences.categories.length === 0}
                    label={`Categories (${missingReferences.categories.length})`}
                  />
                  <Switch
                    checked={createMissingPayments}
                    onChange={(event) =>
                      setCreateMissingPayments(event.currentTarget.checked)
                    }
                    disabled={missingReferences.payments.length === 0}
                    label={`Payment methods (${missingReferences.payments.length})`}
                  />
                  <Switch
                    checked={createMissingAccounts}
                    onChange={(event) =>
                      setCreateMissingAccounts(event.currentTarget.checked)
                    }
                    disabled={missingReferences.accounts.length === 0}
                    label={`Accounts (${missingReferences.accounts.length})`}
                  />
                </Group>
                <Group gap="sm" align="flex-end" wrap="wrap">
                  <Select
                    label="New account type"
                    data={accountTypeOptions}
                    value={newAccountType}
                    onChange={(value) =>
                      setNewAccountType((value ?? "bank") as Account["type"])
                    }
                    disabled={
                      !createMissingAccounts ||
                      missingReferences.accounts.length === 0
                    }
                    style={{ minWidth: 160 }}
                  />
                  <Text size="xs" c="dimmed" style={{ maxWidth: 320 }}>
                    Account type applies to any new accounts. You can edit them
                    later in Settings.
                  </Text>
                </Group>
                {missingReferences.categoryConflicts.length > 0 ? (
                  <Alert color="yellow" variant="light">
                    Some categories appear in both income and expense rows.
                    They'll be created as {importDefaultType}.
                  </Alert>
                ) : null}
                {hasMissingReferences ? (
                  <Text size="xs" c="dimmed">
                    Missing items will be created before import. Preview
                    warnings may still appear until you import.
                  </Text>
                ) : null}
              </Stack>
            </Paper>
          </>
        ) : null}

        <Divider />

        <PreviewSection
          parsedRowCount={activeRowCount}
          validRows={activeValidRows}
          invalidRows={activeInvalidRows}
          warnings={activeWarnings}
          importError={importError}
          importResult={importResult}
          importProgress={importProgress}
          onExportErrors={handleExportErrors}
          onRetryFailedRows={handleRetryFailedRows}
          canRetryFailedRows={canRetryFailedRows}
          showRetryHint={showRetryHint}
          onRowEdit={handleRowEdit}
        />

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Close
          </Button>
          <Button
            color="green"
            onClick={handleImportTransactions}
            disabled={!canImport}
            loading={Boolean(importProgress)}
          >
            Import {activeValidRows.length} rows
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
