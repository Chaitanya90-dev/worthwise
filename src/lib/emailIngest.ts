const UUID_WITH_DASHES_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_NO_DASHES_RE = /^[0-9a-f]{32}$/i;
const EMAIL_INGEST_ALIAS_RE =
  /\bcc[_-]?([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;

const normalizeUserId = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (UUID_WITH_DASHES_RE.test(trimmed)) {
    return trimmed;
  }

  const compact = trimmed.replaceAll("-", "");
  if (!UUID_NO_DASHES_RE.test(compact)) {
    return null;
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
};

export const buildEmailIngestAlias = (userId: string) => {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return "";
  }
  return `cc_${normalized.replaceAll("-", "")}`;
};

export const buildEmailIngestAddress = (
  userId: string,
  domain?: string | null,
) => {
  const alias = buildEmailIngestAlias(userId);
  const cleanDomain = domain?.trim().replace(/^@+/, "").toLowerCase() ?? "";
  if (!alias || !cleanDomain) {
    return null;
  }
  return `${alias}@${cleanDomain}`;
};

export const extractUserIdFromEmailIngestAlias = (value: string) => {
  const match = value.match(EMAIL_INGEST_ALIAS_RE);
  if (!match) {
    return null;
  }
  return normalizeUserId(match[1] ?? "");
};
