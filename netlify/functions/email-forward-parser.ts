import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { parseSmartText } from "../../src/lib/smartTextParser";
import {
  buildEmailSmartParseInput,
  extractIncomingEmailPayload,
} from "../../src/lib/emailPayload";
import { extractUserIdFromEmailIngestAlias } from "../../src/lib/emailIngest";
import { parseInboundRequestBody } from "../../src/lib/inboundRequestParser";
import type { ImportDefaults, ImportLookups } from "../../src/lib/transactionImport";
import type { TransactionRule } from "../../src/types/finance";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EMAIL_INGEST_SECRET = process.env.EMAIL_INGEST_SECRET || "";

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toString = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first.trim() : "";
  }
  return "";
};

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(lower)) return true;
    if (["0", "false", "no", "n"].includes(lower)) return false;
  }
  return fallback;
};

const normalizeTags = (tags: string[]) =>
  Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

const upsertTransactionTags = async ({
  supabase,
  userId,
  transactionId,
  tags,
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  transactionId: string;
  tags: string[];
}) => {
  const normalized = normalizeTags(tags);
  if (normalized.length === 0) {
    return;
  }

  const { data: tagRows, error: tagError } = await supabase
    .from("tags")
    .upsert(
      normalized.map((name) => ({
        user_id: userId,
        name,
      })),
      { onConflict: "user_id,name" },
    )
    .select("id");

  if (tagError) {
    throw new Error(tagError.message);
  }

  const rows = (tagRows ?? []).map((tag) => ({
    user_id: userId,
    transaction_id: transactionId,
    tag_id: tag.id,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("transaction_tags").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
};

const findUserIdByEmail = async (
  supabase: ReturnType<typeof createClient>,
  email: string,
) => {
  let page = 1;
  const lowerEmail = email.toLowerCase();

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === lowerEmail);
    if (found) {
      return found.id;
    }

    if (users.length < 200) {
      break;
    }
    page += 1;
  }

  return null;
};

const validateUserId = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("not found")) {
      return false;
    }
    throw new Error(error.message);
  }
  return Boolean(data?.user);
};

const findUserIdByRecipientAlias = async (
  supabase: ReturnType<typeof createClient>,
  recipientEmails: string[],
) => {
  for (const recipient of recipientEmails) {
    const userId = extractUserIdFromEmailIngestAlias(recipient);
    if (!userId) {
      continue;
    }
    if (await validateUserId(supabase, userId)) {
      return userId;
    }
  }

  return null;
};

const buildLookups = ({
  categories,
  paymentMethods,
  accounts,
}: {
  categories: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
}): ImportLookups => ({
  categoryByName: new Map(
    categories.map((item) => [item.name.trim().toLowerCase(), item.id]),
  ),
  categoryById: new Map(categories.map((item) => [item.id, item.name])),
  paymentByName: new Map(
    paymentMethods.map((item) => [item.name.trim().toLowerCase(), item.id]),
  ),
  paymentById: new Map(paymentMethods.map((item) => [item.id, item.name])),
  accountByName: new Map(
    accounts.map((item) => [item.name.trim().toLowerCase(), item.id]),
  ),
  accountById: new Map(accounts.map((item) => [item.id, item.name])),
});

const buildDefaults = (payload: Record<string, unknown>): ImportDefaults => {
  const defaults = toRecord(payload.defaults) ?? {};
  const defaultTypeRaw = toString(defaults.default_type ?? defaults.defaultType);

  return {
    defaultType: defaultTypeRaw === "income" ? "income" : "expense",
    defaultCategoryId: toString(
      defaults.default_category_id ?? defaults.defaultCategoryId,
    ),
    defaultPaymentId: toString(
      defaults.default_payment_method_id ?? defaults.defaultPaymentId,
    ),
    defaultAccountId: toString(
      defaults.default_account_id ?? defaults.defaultAccountId,
    ),
    recurring: toBoolean(defaults.recurring, false),
  };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "missing_supabase_config" });
  }

  const payload = parseInboundRequestBody({
    body: event.body,
    isBase64Encoded: event.isBase64Encoded,
    headers: event.headers,
  });

  const providedSecret =
    event.headers["x-cashcove-ingest-secret"] ||
    event.headers["X-Cashcove-Ingest-Secret"] ||
    toString(payload.secret);

  if (EMAIL_INGEST_SECRET && providedSecret !== EMAIL_INGEST_SECRET) {
    return json(401, { ok: false, error: "invalid_ingest_secret" });
  }

  const dryRun =
    toBoolean(event.queryStringParameters?.dry_run, false) ||
    toBoolean(payload.dry_run, false);

  const incoming = extractIncomingEmailPayload(payload);
  const parseText = buildEmailSmartParseInput({
    subject: incoming.subject,
    text: incoming.text,
  });

  if (!parseText) {
    return json(422, {
      ok: false,
      error: "missing_email_text",
      hint: "Provide text/plain body, or JSON with text/html fields.",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userIdFromPayload = toString(payload.user_id);
  let userId = userIdFromPayload || null;
  let resolvedVia: "payload_user_id" | "recipient_alias" | "sender_email" | null =
    userIdFromPayload ? "payload_user_id" : null;

  try {
    if (!userId) {
      userId = await findUserIdByRecipientAlias(
        supabase,
        incoming.recipientEmails,
      );
      if (userId) {
        resolvedVia = "recipient_alias";
      }
    }

    if (!userId) {
      if (!incoming.fromEmail) {
        return json(422, {
          ok: false,
          error: "user_resolution_failed",
          hint: "Pass user_id, forward to your recipient alias, or include a trusted sender email.",
          recipient_emails: incoming.recipientEmails,
        });
      }
      userId = await findUserIdByEmail(supabase, incoming.fromEmail);
      if (userId) {
        resolvedVia = "sender_email";
      }
    }
  } catch (err) {
    return json(500, {
      ok: false,
      error: "user_lookup_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (!userId) {
    return json(404, {
      ok: false,
      error: "user_not_found",
      detail: incoming.fromEmail
        ? `No user matched sender email ${incoming.fromEmail}`
        : "No matching user.",
      recipient_emails: incoming.recipientEmails,
    });
  }

  const [
    { data: categories, error: categoryError },
    { data: paymentMethods, error: paymentError },
    { data: accounts, error: accountError },
    { data: rules, error: rulesError },
  ] = await Promise.all([
    supabase.from("categories").select("id, name").eq("user_id", userId),
    supabase.from("payment_methods").select("id, name").eq("user_id", userId),
    supabase.from("accounts").select("id, name").eq("user_id", userId),
    supabase
      .from("rules")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (categoryError || paymentError || accountError || rulesError) {
    return json(500, {
      ok: false,
      error: "context_fetch_failed",
      detail:
        categoryError?.message ||
        paymentError?.message ||
        accountError?.message ||
        rulesError?.message ||
        "Unknown context error",
    });
  }

  const lookups = buildLookups({
    categories: categories ?? [],
    paymentMethods: paymentMethods ?? [],
    accounts: accounts ?? [],
  });
  const defaults = buildDefaults(payload);

  const parseResult = parseSmartText({
    text: parseText,
    defaults,
    lookups,
    rules: (rules ?? []) as TransactionRule[],
  });

  if (parseResult.validRows.length === 0) {
    return json(422, {
      ok: false,
      error: "no_transactions_parsed",
      summary: parseResult.summary,
      lines: parseResult.lines.slice(0, 10),
    });
  }

  if (dryRun) {
    return json(200, {
      ok: true,
      dry_run: true,
      user_id: userId,
      resolved_via: resolvedVia,
      sender_email: incoming.fromEmail,
      recipient_emails: incoming.recipientEmails,
      summary: parseResult.summary,
      preview: parseResult.validRows.slice(0, 20).map((row) => row.preview),
    });
  }

  const imported: Array<{ id: string; amount: number; date: string }> = [];
  const failed: Array<{ row: number; error: string }> = [];

  for (const row of parseResult.validRows) {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: row.data.type,
        date: row.data.date,
        amount: Math.abs(row.data.amount),
        category_id: row.data.category_id,
        payment_method_id: row.data.payment_method_id,
        account_id: row.data.account_id,
        merchant: row.data.merchant,
        notes_enc: row.data.notes,
        is_recurring: row.data.is_recurring,
      })
      .select("id, amount, date")
      .single();

    if (error || !data) {
      failed.push({
        row: row.rowNumber,
        error: error?.message ?? "insert_failed",
      });
      continue;
    }

    try {
      await upsertTransactionTags({
        supabase,
        userId,
        transactionId: data.id,
        tags: row.data.tags ?? [],
      });
    } catch (tagErr) {
      failed.push({
        row: row.rowNumber,
        error:
          tagErr instanceof Error
            ? `tags_failed: ${tagErr.message}`
            : "tags_failed",
      });
    }

    imported.push({
      id: data.id,
      amount: Number(data.amount),
      date: data.date,
    });
  }

  return json(200, {
    ok: true,
    dry_run: false,
    user_id: userId,
    resolved_via: resolvedVia,
    sender_email: incoming.fromEmail,
    recipient_emails: incoming.recipientEmails,
    parsed_rows: parseResult.validRows.length,
    imported_count: imported.length,
    failed_count: failed.length,
    failed,
    imported,
  });
};
