import "jsr:@supabase/functions-js/edge-runtime.d.ts";
declare const Deno: any;
import { createClient } from "@supabase/supabase-js";
import { resolveCounterpartyFields } from "../../../src/lib/counterparty.ts";
import { applyRulesToTransaction } from "../../../src/lib/rules.ts";
import { parseTelegramMessage } from "./parser.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FUNCTION_SLUG = "telegram-bot";
const FALLBACK_CURRENCY = "USD";
const FALLBACK_LOCALE = "en-US";

const deriveFunctionWebhookUrl = () => {
  if (!SUPABASE_URL) {
    return null;
  }

  try {
    const hostname = new URL(SUPABASE_URL).hostname;
    const [projectRef] = hostname.split(".");
    if (!projectRef) {
      return null;
    }
    return `https://${projectRef}.functions.supabase.co/${FUNCTION_SLUG}`;
  } catch {
    return null;
  }
};

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const EXPECTED_WEBHOOK_URL = deriveFunctionWebhookUrl();

const HELP_TEXT = `Send expenses in this format:

<amount> at <merchant> for <notes> via <account/payment> category <category> tags <tag1, tag2>

Example:
24.50 at Blue Bottle for coffee via Chase debit category Food tags cafe,work

Income example:
received 2400 from ACME Payroll into Main checking via bank transfer category Salary tags payroll,march

Strict format (least ambiguity):
amt=24.50; merchant=Blue Bottle; notes=coffee; account=Main checking; payment=debit card; category=Food; tags=cafe,work

You can also add hashtags anywhere:
24.50 at Blue Bottle for coffee via Main checking #cafe #work

Commands:
/help for examples
/status to confirm your linked chat`;

const formatCurrency = ({
  amount,
  currency,
  locale,
}: {
  amount: number;
  currency?: string | null;
  locale?: string | null;
}) =>
  new Intl.NumberFormat(locale || FALLBACK_LOCALE, {
    style: "currency",
    currency: String(currency || FALLBACK_CURRENCY).toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);

const sendMessage = async (chatId: number, text: string) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with ${response.status}`);
  }

  const data = await response.json();
  if (!data?.ok) {
    throw new Error(
      `Telegram sendMessage returned error: ${data?.description ?? "unknown"}`,
    );
  }

  return data.result ?? null;
};

const telegramApiCall = async (
  method: string,
  payload?: Record<string, unknown>,
) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : "{}",
  });

  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed with ${response.status}`);
  }

  const data = await response.json();
  if (!data?.ok) {
    throw new Error(
      `Telegram API ${method} returned error: ${data?.description ?? "unknown"}`,
    );
  }

  return data.result;
};

let webhookReady = false;
let webhookEnsureInFlight: Promise<void> | null = null;

const ensureTelegramWebhook = async () => {
  if (
    webhookReady ||
    webhookEnsureInFlight ||
    !TELEGRAM_BOT_TOKEN ||
    !EXPECTED_WEBHOOK_URL
  ) {
    return webhookEnsureInFlight ?? Promise.resolve();
  }

  webhookEnsureInFlight = (async () => {
    try {
      const info = await telegramApiCall("getWebhookInfo");
      if (info?.url === EXPECTED_WEBHOOK_URL) {
        webhookReady = true;
        return;
      }

      await telegramApiCall("setWebhook", { url: EXPECTED_WEBHOOK_URL });
      const verify = await telegramApiCall("getWebhookInfo");
      if (verify?.url !== EXPECTED_WEBHOOK_URL) {
        throw new Error("Webhook URL mismatch after setWebhook");
      }
      webhookReady = true;
      console.log("Telegram webhook configured", {
        webhookUrl: EXPECTED_WEBHOOK_URL,
      });
    } catch (err) {
      console.error("Failed to ensure Telegram webhook", err);
    } finally {
      webhookEnsureInFlight = null;
    }
  })();

  return webhookEnsureInFlight;
};

type TelegramIngestStatus =
  | "unlinked_chat"
  | "parse_failed"
  | "insert_failed"
  | "success"
  | "error";

const logTelegramIngestEvent = async ({
  userId,
  chatId,
  messageText,
  status,
  errorText,
  parsedPayload,
  transactionId,
}: {
  userId: string | null;
  chatId: number | null;
  messageText: string | null;
  status: TelegramIngestStatus;
  errorText?: string | null;
  parsedPayload?: unknown;
  transactionId?: string | null;
}) => {
  try {
    const { error } = await supabase.from("telegram_ingest_events").insert({
      user_id: userId,
      chat_id: chatId,
      message_text: messageText,
      parse_status: status,
      error_text: errorText ?? null,
      parsed_payload: parsedPayload ?? null,
      transaction_id: transactionId ?? null,
    });
    if (error) {
      console.error("Failed to insert telegram_ingest_events row", error);
    }
  } catch (err) {
    console.error("Failed to log telegram ingest event", err);
  }
};

const normalizeTags = (tags: string[]) =>
  Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

const reserveTelegramUpdate = async ({
  updateId,
  chatId,
  messageId,
}: {
  updateId: number | null;
  chatId: number;
  messageId: number | null;
}) => {
  if (updateId === null || messageId === null) {
    return true;
  }

  const { error } = await supabase.from("telegram_update_receipts").insert({
    update_id: updateId,
    chat_id: chatId,
    message_id: messageId,
  });

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    return false;
  }

  throw error;
};

const normalizeCommand = (text: string) =>
  text
    .split(/\s+/, 1)[0]
    ?.toLowerCase()
    .replace(/@[\w_]+$/, "") ?? "";

const normalizeSmallTalk = (text: string) =>
  text.toLowerCase().replace(/[.!?,]+$/g, "").trim();

const upsertTransactionTags = async ({
  userId,
  transactionId,
  tags,
}: {
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
    .select("id, name");

  if (tagError) {
    throw tagError;
  }

  const linkRows = (tagRows ?? []).map((tag) => ({
    user_id: userId,
    transaction_id: transactionId,
    tag_id: tag.id,
  }));

  if (linkRows.length === 0) {
    return;
  }

  const { error: linkError } = await supabase
    .from("transaction_tags")
    .insert(linkRows);

  if (linkError) {
    throw linkError;
  }
};

Deno.serve(async (req) => {
  let eventChatId: number | null = null;
  let eventText: string | null = null;
  let eventUserId: string | null = null;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  await ensureTelegramWebhook();

  try {
    const update = await req.json();

    // 1. Verify update contains message
    const message = update.message;
    if (!message || (!message.text && !message.caption)) {
      return new Response("OK"); // Telegram wants a 200 even if we ignore it
    }

    const { chat, from } = message;
    const text = String(message.text ?? message.caption ?? "").trim();
    if (!text) {
      return new Response("OK");
    }

    const chatId = chat.id;
    const command = text.startsWith("/") ? normalizeCommand(text) : "";
    const smallTalk = normalizeSmallTalk(text);
    const updateId = typeof update.update_id === "number" ? update.update_id : null;
    const messageId = typeof message.message_id === "number" ? message.message_id : null;
    eventChatId = chatId;
    eventText = text;

    const isFreshUpdate = await reserveTelegramUpdate({
      updateId,
      chatId,
      messageId,
    });

    if (!isFreshUpdate) {
      console.log("Duplicate telegram update ignored", {
        updateId,
        chatId,
        messageId,
      });
      return new Response("OK");
    }

    // 2. Identify user by telegram_chat_id
    const { data: profile } = await supabase
      .from("user_preferences")
      .select("user_id, base_currency, locale")
      .eq("telegram_chat_id", chatId)
      .single();

    if (!profile) {
      // 3. Unauthorized / First time
      const reply = await sendMessage(
        chatId,
        `Hello ${from?.first_name ?? "there"}!\n\nYour account is not linked to Cash Cove yet.\n\nTo link it, open your app settings, click "Connect Telegram", and paste this ID: ${chatId}`,
      );
      await logTelegramIngestEvent({
        userId: null,
        chatId,
        messageText: text,
        status: "unlinked_chat",
        parsedPayload: {
          reply_message_id:
            typeof reply?.message_id === "number" ? reply.message_id : null,
        },
      });
      return new Response("OK");
    }

    const userId = profile.user_id;
    eventUserId = userId;

    // 4. Handle commands and greetings
    const greetingWords = new Set(["hi", "hello", "hey", "hola", "start", "help", "menu"]);
    const acknowledgeWords = new Set(["done", "thanks", "thank you", "ok", "okay", "yes", "no"]);

    if (command) {
      if (command === "/start" || command === "/help" || command === "/examples") {
        await sendMessage(
          chatId,
          `Hi ${from?.first_name ?? "there"}! I'm your Cash Cove assistant.\n\n${HELP_TEXT}`,
        );
        return new Response("OK");
      }

      if (command === "/status") {
        await sendMessage(
          chatId,
          `Your Telegram chat is linked to Cash Cove.\nChat ID: ${chatId}\n\nSend a transaction in free-form or strict format.\n\n${HELP_TEXT}`,
        );
        return new Response("OK");
      }

      await sendMessage(
        chatId,
        `I don't recognize ${command}.\n\n${HELP_TEXT}`,
      );
      return new Response("OK");
    }

    if (greetingWords.has(smallTalk) || acknowledgeWords.has(smallTalk)) {
      console.log(
        `Ignoring conversational Telegram message: "${text}"`,
      );
      if (greetingWords.has(smallTalk)) {
        await sendMessage(
          chatId,
          `Hi ${from?.first_name ?? "there"}! I'm your Cash Cove assistant.\n\n${HELP_TEXT}`,
        );
      }
      return new Response("OK");
    }

    // 5. Fetch User Context (Categories, Accounts, Payment Methods, Rules)
    const [
      { data: categories },
      { data: accounts },
      { data: paymentMethods },
      { data: rules },
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, type")
        .eq("user_id", userId),
      supabase.from("accounts").select("id, name, type, currency").eq("user_id", userId),
      supabase.from("payment_methods").select("id, name").eq("user_id", userId),
      supabase
        .from("rules")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

    // 6. Advanced free-form parsing + fuzzy resolution
    const parsed = parseTelegramMessage({
      text,
      categories: categories ?? [],
      paymentMethods: paymentMethods ?? [],
      accounts: accounts ?? [],
    });

    console.log("Parsed telegram message", {
      text,
      normalizedText: parsed.normalizedText,
      type: parsed.type,
      amount: parsed.amount,
      merchant: parsed.merchant,
      notes: parsed.notes,
      tags: parsed.tags,
      categoryId: parsed.categoryId,
      paymentMethodId: parsed.paymentMethodId,
      accountId: parsed.accountId,
    });

    if (!parsed.amount || parsed.amount <= 0) {
      const reply = await sendMessage(
        chatId,
        `I couldn't find an amount in that message.\n\n${HELP_TEXT}`,
      );
      await logTelegramIngestEvent({
        userId,
        chatId,
        messageText: text,
        status: "parse_failed",
        errorText: "amount_not_found",
        parsedPayload: {
          ...parsed,
          reply_message_id:
            typeof reply?.message_id === "number" ? reply.message_id : null,
        },
      });
      return new Response("OK");
    }

    // 7. Apply Rules Engine
    const merchant =
      parsed.merchant ||
      (parsed.type === "income" ? "Telegram Income" : "Telegram Entry");
    const notes = parsed.notes || null;
    const ruleResult = applyRulesToTransaction(
      {
        merchant,
        notes,
        type: parsed.type,
        category_id: parsed.categoryId,
        tags: [],
      },
      rules ?? [],
    );

    const categoryId = ruleResult.category_id;
    const accountId = parsed.accountId;
    const paymentMethodId = parsed.paymentMethodId;
    const tags = normalizeTags([...parsed.tags, ...ruleResult.tags]);
    const finalMerchant = ruleResult.merchant ?? merchant;
    const selectedAccount = accounts?.find((account) => account.id === accountId) ?? null;
    const transactionCurrency = String(
      selectedAccount?.currency ?? profile.base_currency ?? FALLBACK_CURRENCY,
    ).toUpperCase();
    const amountLabel = formatCurrency({
      amount: parsed.amount,
      currency: transactionCurrency,
      locale: profile.locale ?? FALLBACK_LOCALE,
    });
    const counterparty = resolveCounterpartyFields({
      merchant: finalMerchant,
    });

    // 8. Final Insert
    const { data: inserted, error: insertError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Math.abs(parsed.amount),
        currency: transactionCurrency,
        type: parsed.type,
        counterparty_name: counterparty.counterparty_name,
        counterparty_kind: counterparty.counterparty_kind,
        merchant: counterparty.merchant,
        notes_enc: notes,
        date: parsed.date,
        category_id: categoryId,
        account_id: accountId,
        payment_method_id: paymentMethodId,
        is_recurring: false,
      })
      .select()
      .single();

    if (insertError) {
      await logTelegramIngestEvent({
        userId,
        chatId,
        messageText: text,
        status: "insert_failed",
        errorText: insertError.message,
        parsedPayload: parsed,
      });
      throw insertError;
    }

    // 9. Handle Tags (if any)
    if (tags.length > 0 && inserted) {
      await upsertTransactionTags({
        userId,
        transactionId: inserted.id,
        tags,
      });
    }

    // 10. Send confirmation
    let confMsg =
      parsed.type === "income"
        ? `Logged income: ${amountLabel} from ${finalMerchant}`
        : `Logged expense: ${amountLabel} at ${finalMerchant}`;
    if (notes) {
      confMsg += `\nNotes: ${notes}`;
    }
    if (categoryId) {
      const catName = categories?.find((c) => c.id === categoryId)?.name;
      if (catName) confMsg += `\n📁 Category: ${catName}`;
    }
    if (accountId) {
      const accountName = accounts?.find((account) => account.id === accountId)?.name;
      if (accountName) confMsg += `\n🏦 Account: ${accountName}`;
    }
    if (paymentMethodId) {
      const paymentName = paymentMethods?.find((payment) => payment.id === paymentMethodId)?.name;
      if (paymentName) confMsg += `\n💳 Payment: ${paymentName}`;
    }
    if (tags.length > 0) {
      confMsg += `\n🏷️ Tags: ${tags.join(", ")}`;
    }

    const reply = await sendMessage(chatId, confMsg);

    await logTelegramIngestEvent({
      userId,
      chatId,
      messageText: text,
      status: "success",
      parsedPayload: {
        parsed,
        finalMerchant,
        categoryId,
        accountId,
        paymentMethodId,
        tags,
        reply_message_id:
          typeof reply?.message_id === "number" ? reply.message_id : null,
      },
      transactionId: inserted?.id ?? null,
    });

    return new Response("OK");
  } catch (err) {
    console.error("Function error:", err);
    if (eventText) {
      await logTelegramIngestEvent({
        userId: eventUserId,
        chatId: eventChatId,
        messageText: eventText,
        status: "error",
        errorText:
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : typeof err === "string"
              ? err
              : "Unknown error",
      });
    }
    return new Response("Server Error", { status: 500 });
  }
});
