import dayjs from "dayjs";
import type {
  Account,
  Budget,
  Category,
  Fund,
  FundContribution,
  PaymentMethod,
  Reconciliation,
  Subscription,
  Tag,
  Transaction,
  TransactionRule,
  UserPreferences,
} from "../types/finance";
import { buildReportCsvRows, downloadCsv } from "./reports";
import { supabase } from "./supabaseClient";

export type TransactionTagRow = {
  transaction_id: string;
  tag_id: string;
};

export type BackupPayload = {
  version: number;
  generated_at: string;
  data: {
    categories: Category[];
    payment_methods: PaymentMethod[];
    accounts: Account[];
    tags: Tag[];
    transactions: Transaction[];
    transaction_tags: TransactionTagRow[];
    shared_expenses: Record<string, unknown>[];
    shared_participants: Record<string, unknown>[];
    shared_reimbursements: Record<string, unknown>[];
    budgets: Budget[];
    funds: Fund[];
    fund_contributions: FundContribution[];
    subscriptions: Subscription[];
    reconciliations: Reconciliation[];
    rules: TransactionRule[];
    user_preferences: UserPreferences[];
  };
};

export type EncryptedBackup = {
  version: number;
  encrypted: true;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  payload: string;
};

const ITERATIONS = 120000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const downloadTextFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
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

const fetchTable = async <T>(table: string, select = "*") => {
  const { data, error } = await supabase.from(table).select(select);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as T[];
};

export const buildBackupPayload = async (): Promise<BackupPayload> => {
  const [
    categories,
    paymentMethods,
    accounts,
    tags,
    transactions,
    transactionTags,
    sharedExpenses,
    sharedParticipants,
    sharedReimbursements,
    budgets,
    funds,
    fundContributions,
    subscriptions,
    reconciliations,
    rules,
    userPreferences,
  ] = await Promise.all([
    fetchTable<Category>("categories"),
    fetchTable<PaymentMethod>("payment_methods"),
    fetchTable<Account>("accounts"),
    fetchTable<Tag>("tags"),
    fetchTable<Transaction>("transactions"),
    fetchTable<TransactionTagRow>("transaction_tags"),
    fetchTable<Record<string, unknown>>("shared_expenses"),
    fetchTable<Record<string, unknown>>("shared_participants"),
    fetchTable<Record<string, unknown>>("shared_reimbursements"),
    fetchTable<Budget>("budgets"),
    fetchTable<Fund>("funds"),
    fetchTable<FundContribution>("fund_contributions"),
    fetchTable<Subscription>("subscriptions"),
    fetchTable<Reconciliation>("reconciliations"),
    fetchTable<TransactionRule>("rules"),
    fetchTable<UserPreferences>("user_preferences"),
  ]);

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    data: {
      categories,
      payment_methods: paymentMethods,
      accounts,
      tags,
      transactions,
      transaction_tags: transactionTags,
      shared_expenses: sharedExpenses,
      shared_participants: sharedParticipants,
      shared_reimbursements: sharedReimbursements,
      budgets,
      funds,
      fund_contributions: fundContributions,
      subscriptions,
      reconciliations,
      rules,
      user_preferences: userPreferences,
    },
  };
};

const buildTransactionsForCsv = (payload: BackupPayload) => {
  const tagMap = new Map(payload.data.tags.map((tag) => [tag.id, tag.name]));
  const tagsByTransaction = new Map<string, Tag[]>();
  payload.data.transaction_tags.forEach((link) => {
    const tagName = tagMap.get(link.tag_id);
    if (!tagName) {
      return;
    }
    const existing = tagsByTransaction.get(link.transaction_id) ?? [];
    existing.push({ id: link.tag_id, name: tagName });
    tagsByTransaction.set(link.transaction_id, existing);
  });

  return payload.data.transactions.map((tx) => ({
    ...tx,
    amount: Number(tx.amount),
    notes: tx.notes ?? tx.notes_enc ?? null,
    notes_enc: tx.notes_enc ?? tx.notes ?? null,
    is_transfer: Boolean(tx.is_transfer),
    transfer_group_id: tx.transfer_group_id ?? null,
    is_reimbursement: Boolean(tx.is_reimbursement),
    is_shared: Boolean(tx.is_shared),
    is_recurring: Boolean(tx.is_recurring),
    tags: tagsByTransaction.get(tx.id) ?? [],
  })) as Transaction[];
};

export const exportTransactionsCsv = async () => {
  const payload = await buildBackupPayload();
  const categoryMap = new Map(
    payload.data.categories.map((category) => [category.id, category.name])
  );
  const accountMap = new Map(
    payload.data.accounts.map((account) => [account.id, account.name])
  );
  const paymentMap = new Map(
    payload.data.payment_methods.map((method) => [method.id, method.name])
  );
  const rows = buildReportCsvRows(
    buildTransactionsForCsv(payload),
    categoryMap,
    accountMap,
    paymentMap
  );
  const stamp = dayjs().format("YYYY-MM-DD");
  downloadCsv(`cashcove-transactions-${stamp}.csv`, rows);
};

const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  const saltBuffer = salt.buffer as ArrayBuffer;
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
};

const encryptBackup = async (
  payload: BackupPayload,
  passphrase: string
): Promise<EncryptedBackup> => {
  if (!crypto?.subtle) {
    throw new Error("Encryption is not supported in this browser.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(payload))
    )
  );
  const packed = [toBase64(salt), toBase64(iv), toBase64(cipher)].join(":");

  return {
    version: 1,
    encrypted: true,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    payload: packed,
  };
};

export const isEncryptedBackup = (value: unknown): value is EncryptedBackup =>
  Boolean(value && typeof value === "object" && (value as EncryptedBackup).encrypted);

const decodeEncryptedPayload = (payload: string) => {
  const [saltPart, ivPart, dataPart] = payload.split(":");
  if (!saltPart || !ivPart || !dataPart) {
    throw new Error("Encrypted backup payload is invalid.");
  }
  return {
    salt: fromBase64(saltPart),
    iv: fromBase64(ivPart),
    data: fromBase64(dataPart),
  };
};

export const decryptBackupPayload = async (
  encrypted: EncryptedBackup,
  passphrase: string
): Promise<BackupPayload> => {
  if (!crypto?.subtle) {
    throw new Error("Decryption is not supported in this browser.");
  }
  const { salt, iv, data } = decodeEncryptedPayload(encrypted.payload);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  const parsed = JSON.parse(decoder.decode(new Uint8Array(plain)));
  return parsed as BackupPayload;
};

export const validateBackupPayload = (payload: BackupPayload) => {
  if (!payload || payload.version !== 1 || !payload.data) {
    throw new Error("Backup format is not supported.");
  }
  const { data } = payload;
  const required: Array<keyof BackupPayload["data"]> = [
    "categories",
    "payment_methods",
    "accounts",
    "tags",
    "transactions",
    "transaction_tags",
    "shared_expenses",
    "shared_participants",
    "shared_reimbursements",
    "budgets",
    "funds",
    "fund_contributions",
    "subscriptions",
    "reconciliations",
    "rules",
    "user_preferences",
  ];
  required.forEach((key) => {
    if (!Array.isArray(data[key])) {
      throw new Error(`Backup data is missing ${key}.`);
    }
  });
  return payload;
};

export const getBackupSummary = (payload: BackupPayload) => [
  { label: "Categories", count: payload.data.categories.length },
  { label: "Payment methods", count: payload.data.payment_methods.length },
  { label: "Accounts", count: payload.data.accounts.length },
  { label: "Tags", count: payload.data.tags.length },
  { label: "Transactions", count: payload.data.transactions.length },
  { label: "Shared expenses", count: payload.data.shared_expenses.length },
  { label: "Budgets", count: payload.data.budgets.length },
  { label: "Funds", count: payload.data.funds.length },
  { label: "Subscriptions", count: payload.data.subscriptions.length },
  { label: "Rules", count: payload.data.rules.length },
];

export type RestorePlanOptions = {
  wipeExisting: boolean;
  useBackupBalances: boolean;
};

export type RestoreReport = {
  version: number;
  generated_at: string;
  backup_generated_at: string;
  mode: "replace" | "merge";
  use_backup_balances: boolean;
  counts: ReturnType<typeof getBackupSummary>;
  tables: string[];
  notes: string[];
};

export const buildRestoreReport = (
  payload: BackupPayload,
  options: RestorePlanOptions
): RestoreReport => {
  const tables = [
    "categories",
    "payment_methods",
    "accounts",
    "tags",
    "transactions",
    "transaction_tags",
    "shared_expenses",
    "shared_participants",
    "shared_reimbursements",
    "budgets",
    "funds",
    "fund_contributions",
    "subscriptions",
    "reconciliations",
    "rules",
    "user_preferences",
  ];

  const notes = [
    options.wipeExisting
      ? "Existing rows will be deleted before import."
      : "Rows will be inserted on top of existing data (duplicates possible).",
    options.useBackupBalances
      ? "Account balances will be restored from the backup snapshot."
      : "Account balances will be recalculated from imported transactions.",
  ];

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    backup_generated_at: payload.generated_at,
    mode: options.wipeExisting ? "replace" : "merge",
    use_backup_balances: options.useBackupBalances,
    counts: getBackupSummary(payload),
    tables,
    notes,
  };
};

export const exportRestoreReport = async (
  payload: BackupPayload,
  options: RestorePlanOptions
) => {
  const report = buildRestoreReport(payload, options);
  const stamp = dayjs().format("YYYY-MM-DD");
  downloadTextFile(
    `cashcove-restore-report-${stamp}.json`,
    JSON.stringify(report, null, 2),
    "application/json"
  );
};

export const exportBackupJson = async (options: {
  encrypt: boolean;
  passphrase?: string;
}) => {
  const payload = await buildBackupPayload();
  const stamp = dayjs().format("YYYY-MM-DD");
  if (!options.encrypt) {
    downloadTextFile(
      `cashcove-backup-${stamp}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    return;
  }
  const passphrase = options.passphrase ?? "";
  if (passphrase.trim().length < 8) {
    throw new Error("Passphrase must be at least 8 characters.");
  }
  const encrypted = await encryptBackup(payload, passphrase.trim());
  downloadTextFile(
    `cashcove-backup-${stamp}.encrypted.json`,
    JSON.stringify(encrypted, null, 2),
    "application/json"
  );
};

const chunkRows = <T,>(rows: T[], size = 500) => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const deleteAllRows = async (table: string, keyColumn: string) => {
  const { error } = await supabase
    .from(table)
    .delete()
    .neq(keyColumn, "00000000-0000-0000-0000-000000000000");
  if (error) {
    throw new Error(`Unable to clear ${table}: ${error.message}`);
  }
};

const insertRows = async (table: string, rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return;
  }
  for (const chunk of chunkRows(rows)) {
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(`Unable to import ${table}: ${error.message}`);
    }
  }
};

export type RestoreOptions = RestorePlanOptions & {
  userId: string;
};

export const restoreBackup = async (
  payload: BackupPayload,
  options: RestoreOptions
) => {
  const { userId, wipeExisting, useBackupBalances } = options;
  if (!userId) {
    throw new Error("Sign in before restoring a backup.");
  }

  if (wipeExisting) {
    await deleteAllRows("shared_reimbursements", "id");
    await deleteAllRows("shared_participants", "id");
    await deleteAllRows("shared_expenses", "id");
    await deleteAllRows("transaction_tags", "transaction_id");
    await deleteAllRows("transactions", "id");
    await deleteAllRows("reconciliations", "id");
    await deleteAllRows("rules", "id");
    await deleteAllRows("subscriptions", "id");
    await deleteAllRows("fund_contributions", "id");
    await deleteAllRows("funds", "id");
    await deleteAllRows("budgets", "id");
    await deleteAllRows("tags", "id");
    await deleteAllRows("payment_methods", "id");
    await deleteAllRows("accounts", "id");
    await deleteAllRows("categories", "id");
    await deleteAllRows("user_preferences", "user_id");
  }

  const withUserId = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((row) => ({ ...row, user_id: userId }));

  const accountBalanceOverrides = new Map(
    payload.data.accounts.map((account) => [account.id, account.current_balance])
  );
  const accountsForInsert = payload.data.accounts.map((account) => ({
    ...account,
    user_id: userId,
    current_balance: 0,
  }));

  await insertRows("categories", withUserId(payload.data.categories));
  await insertRows("payment_methods", withUserId(payload.data.payment_methods));
  await insertRows("accounts", accountsForInsert as Record<string, unknown>[]);
  await insertRows("tags", withUserId(payload.data.tags));
  await insertRows("transactions", withUserId(payload.data.transactions));
  await insertRows("transaction_tags", withUserId(payload.data.transaction_tags));
  await insertRows("shared_expenses", withUserId(payload.data.shared_expenses));
  await insertRows("shared_participants", withUserId(payload.data.shared_participants));
  await insertRows(
    "shared_reimbursements",
    withUserId(payload.data.shared_reimbursements)
  );
  await insertRows("budgets", withUserId(payload.data.budgets));
  await insertRows("funds", withUserId(payload.data.funds));
  await insertRows("fund_contributions", withUserId(payload.data.fund_contributions));
  await insertRows("subscriptions", withUserId(payload.data.subscriptions));
  await insertRows("reconciliations", withUserId(payload.data.reconciliations));
  await insertRows("rules", withUserId(payload.data.rules));

  const prefs = payload.data.user_preferences.map((pref) => ({
    ...pref,
    user_id: userId,
  }));
  if (prefs.length > 0) {
    const { error } = await supabase
      .from("user_preferences")
      .upsert(prefs, { onConflict: "user_id" });
    if (error) {
      throw new Error(`Unable to import user preferences: ${error.message}`);
    }
  }

  if (useBackupBalances) {
    for (const account of payload.data.accounts) {
      const balance = accountBalanceOverrides.get(account.id);
      if (balance === undefined || balance === null) {
        continue;
      }
      const { error } = await supabase
        .from("accounts")
        .update({ current_balance: balance })
        .eq("id", account.id);
      if (error) {
        throw new Error(`Unable to restore balances: ${error.message}`);
      }
    }
  }
};
