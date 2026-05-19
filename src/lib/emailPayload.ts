export type IncomingEmailPayload = {
  fromEmail: string | null;
  recipientEmails: string[];
  subject: string;
  text: string;
};

const toCleanString = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first.trim() : "";
  }
  return "";
};

const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const pickValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  const normalizedTargets = new Set(keys.map(normalizeKey));
  for (const [key, value] of Object.entries(record)) {
    if (normalizedTargets.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
};

const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

export const extractEmailAddresses = (raw: string): string[] => {
  if (!raw) {
    return [];
  }

  const matches = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map((value) => value.toLowerCase())));
};

export const extractEmailAddress = (raw: string): string | null =>
  extractEmailAddresses(raw)[0] ?? null;

const buildCandidateRecords = (root: Record<string, unknown>) => {
  const candidates: Record<string, unknown>[] = [root];

  const pushIfRecord = (value: unknown) => {
    const record = getRecord(value);
    if (record) {
      candidates.push(record);
    }
  };

  pushIfRecord(pickValue(root, ["data", "payload"]));
  pushIfRecord(pickValue(root, ["email", "mail", "message"]));

  const eventRecord = getRecord(pickValue(root, ["event"]));
  if (eventRecord) {
    candidates.push(eventRecord);
    pushIfRecord(pickValue(eventRecord, ["data", "payload"]));
  }

  return candidates;
};

const extractEmailsFromUnknown = (value: unknown): string[] => {
  if (typeof value === "string") {
    return extractEmailAddresses(value);
  }

  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.flatMap((item) => extractEmailsFromUnknown(item))),
    );
  }

  const record = getRecord(value);
  if (!record) {
    return [];
  }

  const direct = [
    pickValue(record, ["email", "address", "recipient", "to"]),
    pickValue(record, ["delivered_to", "delivered-to", "forwarded_to", "forwarded-to"]),
    pickValue(record, ["original_recipient", "original-recipient"]),
  ];

  return Array.from(
    new Set(
      [...direct, ...Object.values(record)].flatMap((item) =>
        extractEmailsFromUnknown(item),
      ),
    ),
  );
};

const pickFromAddress = (payload: Record<string, unknown>) => {
  const records = buildCandidateRecords(payload);

  for (const record of records) {
    const fromObj = getRecord(
      pickValue(record, ["from_full", "fromfull", "from", "sender"]),
    );
    const envelope = getRecord(pickValue(record, ["envelope"]));
    const headers = getRecord(pickValue(record, ["headers"]));

    const value =
      toCleanString(pickValue(fromObj ?? {}, ["email", "address"])) ||
      toCleanString(
        pickValue(record, [
          "from_email",
          "fromemail",
          "from-address",
          "fromaddress",
          "sender_email",
          "reply_to",
          "reply-to",
          "from",
          "sender",
        ]),
      ) ||
      toCleanString(pickValue(envelope ?? {}, ["from", "sender"])) ||
      toCleanString(pickValue(headers ?? {}, ["from"]));

    if (value) {
      return value;
    }
  }

  return "";
};

const pickRecipientAddresses = (payload: Record<string, unknown>) => {
  const records = buildCandidateRecords(payload);

  for (const record of records) {
    const envelope = getRecord(pickValue(record, ["envelope"]));
    const headers = getRecord(pickValue(record, ["headers"]));

    const recipients = Array.from(
      new Set(
        [
          pickValue(record, [
            "to",
            "to_email",
            "toemail",
            "recipient",
            "recipients",
            "delivered_to",
            "delivered-to",
            "forwarded_to",
            "forwarded-to",
            "original_recipient",
            "original-recipient",
          ]),
          pickValue(envelope ?? {}, ["to", "recipient"]),
          pickValue(headers ?? {}, ["to", "delivered-to"]),
        ].flatMap((item) => extractEmailsFromUnknown(item)),
      ),
    );

    if (recipients.length > 0) {
      return recipients;
    }
  }

  return [];
};

const pickSubject = (payload: Record<string, unknown>) => {
  const records = buildCandidateRecords(payload);
  for (const record of records) {
    const subject = toCleanString(
      pickValue(record, ["subject", "email_subject", "subject_line"]),
    );
    if (subject) {
      return subject;
    }
  }
  return "";
};

const pickTextBody = (payload: Record<string, unknown>) => {
  const records = buildCandidateRecords(payload);
  for (const record of records) {
    const text = toCleanString(
      pickValue(record, [
        "text",
        "textBody",
        "text_body",
        "text-content",
        "textcontent",
        "plain",
        "body",
        "message",
        "stripped-text",
        "stripped_text",
        "body-plain",
        "body_plain",
        "TextBody",
      ]),
    );
    if (text) {
      return text;
    }
  }

  for (const record of records) {
    const html = toCleanString(
      pickValue(record, [
        "html",
        "htmlBody",
        "html_body",
        "stripped-html",
        "stripped_html",
        "body-html",
        "body_html",
        "HtmlBody",
      ]),
    );
    if (html) {
      return stripHtml(html);
    }
  }

  for (const record of records) {
    const raw = toCleanString(
      pickValue(record, ["raw", "raw_email", "email_raw", "mime"]),
    );
    if (raw) {
      return raw;
    }
  }

  return "";
};

export const extractIncomingEmailPayload = (
  payload: unknown,
): IncomingEmailPayload => {
  if (typeof payload === "string") {
    return {
      fromEmail: null,
      recipientEmails: [],
      subject: "",
      text: payload.trim(),
    };
  }

  const record = getRecord(payload);
  if (!record) {
    return {
      fromEmail: null,
      recipientEmails: [],
      subject: "",
      text: "",
    };
  }

  const fromRaw = pickFromAddress(record);
  const fromEmail = extractEmailAddress(fromRaw);
  const recipientEmails = pickRecipientAddresses(record);
  const subject = pickSubject(record);
  const text = pickTextBody(record);

  return {
    fromEmail,
    recipientEmails,
    subject,
    text,
  };
};

export const buildEmailSmartParseInput = ({
  subject,
  text,
}: {
  subject: string;
  text: string;
}) =>
  [subject.trim(), text.trim()]
    .filter(Boolean)
    .join("\n")
    .trim();
