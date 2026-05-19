import { describe, expect, it } from "vitest";
import { parseInboundRequestBody } from "./inboundRequestParser";

const encodeBase64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const btoaFn = (globalThis as { btoa?: (input: string) => string }).btoa;
  if (typeof btoaFn === "function") {
    return btoaFn(binary);
  }

  const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor?.from) {
    return bufferCtor.from(binary, "binary").toString("base64");
  }

  throw new Error("Base64 encoding is unavailable in this runtime.");
};

describe("parseInboundRequestBody", () => {
  it("parses JSON payload", () => {
    const parsed = parseInboundRequestBody({
      body: JSON.stringify({ from: "demo@cashcove.in", subject: "Test" }),
      headers: { "content-type": "application/json" },
    });

    expect(parsed).toEqual({ from: "demo@cashcove.in", subject: "Test" });
  });

  it("parses urlencoded payload", () => {
    const parsed = parseInboundRequestBody({
      body: "from=demo%40cashcove.in&subject=Debit+Alert&text=Rs+60",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(parsed).toEqual({
      from: "demo@cashcove.in",
      subject: "Debit Alert",
      text: "Rs 60",
    });
  });

  it("parses multipart form-data text fields", () => {
    const boundary = "----cashcoveBoundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="from"',
      "",
      "alerts@bank.com",
      `--${boundary}`,
      'Content-Disposition: form-data; name="subject"',
      "",
      "UPI debit alert",
      `--${boundary}`,
      'Content-Disposition: form-data; name="stripped-text"',
      "",
      "A/c XX9965 debited INR 250",
      `--${boundary}`,
      'Content-Disposition: form-data; name="attachment"; filename="statement.pdf"',
      "Content-Type: application/pdf",
      "",
      "<binary>",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const parsed = parseInboundRequestBody({
      body,
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    });

    expect(parsed).toEqual({
      from: "alerts@bank.com",
      subject: "UPI debit alert",
      "stripped-text": "A/c XX9965 debited INR 250",
    });
  });

  it("decodes base64 encoded body", () => {
    const encoded = encodeBase64Utf8('{"subject":"Base64","text":"decoded"}');

    const parsed = parseInboundRequestBody({
      body: encoded,
      isBase64Encoded: true,
      headers: { "content-type": "application/json" },
    });

    expect(parsed).toEqual({ subject: "Base64", text: "decoded" });
  });
});
