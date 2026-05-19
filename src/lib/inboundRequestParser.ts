const getHeader = (headers: Record<string, string | undefined>, key: string) => {
  const target = key.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) {
      return value ?? "";
    }
  }
  return "";
};

const parseMultipartFormData = (raw: string, contentType: string) => {
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  const boundary = boundaryMatch?.[1];
  if (!boundary) {
    return {};
  }

  const sections = raw.split(`--${boundary}`);
  const parsed: Record<string, unknown> = {};

  for (const section of sections) {
    const chunk = section.trim();
    if (!chunk || chunk === "--") {
      continue;
    }

    const normalizedChunk = chunk.replace(/\r\n/g, "\n");
    const separatorIndex = normalizedChunk.indexOf("\n\n");
    if (separatorIndex < 0) {
      continue;
    }

    const headerText = normalizedChunk.slice(0, separatorIndex);
    const bodyText = normalizedChunk
      .slice(separatorIndex + 2)
      .replace(/\n$/, "")
      .replace(/\n--$/, "");

    const dispositionLine = headerText
      .split("\n")
      .find((line) => line.toLowerCase().startsWith("content-disposition:"));

    const fieldName = dispositionLine?.match(/name="([^"]+)"/i)?.[1];
    const hasFilename = /filename="/i.test(dispositionLine ?? "");
    if (!fieldName || hasFilename) {
      continue;
    }

    const value = bodyText.trim();
    if (fieldName in parsed) {
      const existing = parsed[fieldName];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        parsed[fieldName] = [existing, value];
      }
    } else {
      parsed[fieldName] = value;
    }
  }

  return parsed;
};

const decodeBase64Utf8 = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const atobFn = (globalThis as { atob?: (input: string) => string }).atob;
  if (typeof atobFn === "function") {
    const binary = atobFn(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor?.from) {
    return bufferCtor.from(normalized, "base64").toString("utf8");
  }

  throw new Error("Base64 decoding is unavailable in this runtime.");
};

export const parseInboundRequestBody = ({
  body,
  isBase64Encoded = false,
  headers = {},
}: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Record<string, unknown> => {
  if (!body) {
    return {};
  }

  const raw = isBase64Encoded ? decodeBase64Utf8(body) : body;
  const contentTypeRaw = getHeader(headers, "content-type");
  const contentType = contentTypeRaw.toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw)) as Record<string, unknown>;
  }

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartFormData(raw, contentTypeRaw);
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(raw)) as Record<string, unknown>;
  }
};
