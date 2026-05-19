import { describe, expect, it } from "vitest";
import {
  buildEmailSmartParseInput,
  extractEmailAddress,
  extractEmailAddresses,
  extractIncomingEmailPayload,
} from "./emailPayload";

describe("extractEmailAddress", () => {
  it("extracts address from angle bracket format", () => {
    expect(extractEmailAddress("Bank Alerts <alerts@example.com>")).toBe(
      "alerts@example.com",
    );
  });

  it("extracts plain address", () => {
    expect(extractEmailAddress("demo@cashcove.in")).toBe("demo@cashcove.in");
  });

  it("returns null for invalid value", () => {
    expect(extractEmailAddress("")).toBeNull();
    expect(extractEmailAddress("not-an-email")).toBeNull();
  });

  it("extracts multiple addresses from a recipient string", () => {
    expect(
      extractEmailAddresses(
        "CashCove <cc_x@mail.cashcove.in>, Another <demo@cashcove.in>",
      ),
    ).toEqual(["cc_x@mail.cashcove.in", "demo@cashcove.in"]);
  });
});

describe("extractIncomingEmailPayload", () => {
  it("reads common inbound JSON shape", () => {
    const payload = extractIncomingEmailPayload({
      from: "Demo User <demo@cashcove.in>",
      subject: "Fwd: UPI debit",
      text: "rs 60 at VC Cafe for Poli Bhaji",
    });

    expect(payload).toEqual({
      fromEmail: "demo@cashcove.in",
      recipientEmails: [],
      subject: "Fwd: UPI debit",
      text: "rs 60 at VC Cafe for Poli Bhaji",
    });
  });

  it("falls back to nested envelope and html body", () => {
    const payload = extractIncomingEmailPayload({
      envelope: { from: "alerts@bank.com" },
      email: {
        subject: "Debit Alert",
        html: "<div>Rs 425 paid to Zomato via UPI</div>",
      },
    });

    expect(payload.fromEmail).toBe("alerts@bank.com");
    expect(payload.recipientEmails).toEqual([]);
    expect(payload.subject).toBe("Debit Alert");
    expect(payload.text).toContain("Rs 425 paid to Zomato");
  });

  it("parses Mailgun-style stripped text payload", () => {
    const payload = extractIncomingEmailPayload({
      sender: "Bank Alerts <alerts@bank.com>",
      subject: "A/c debit alert",
      "stripped-text":
        "A/c XX9965 debited INR 250.00 on 05-Mar-26 UPI/Google Pay/CoffeeDay.",
    });

    expect(payload.fromEmail).toBe("alerts@bank.com");
    expect(payload.recipientEmails).toEqual([]);
    expect(payload.subject).toBe("A/c debit alert");
    expect(payload.text).toContain("A/c XX9965 debited");
  });

  it("parses Postmark-style payload with mixed casing", () => {
    const payload = extractIncomingEmailPayload({
      FromFull: { Email: "notify@bank.com", Name: "Bank Alerts" },
      Subject: "Debit alert",
      TextBody: "Rs 1,250 spent on card XX1004 at AMAZON RETAIL on 07-Mar-26",
    });

    expect(payload.fromEmail).toBe("notify@bank.com");
    expect(payload.recipientEmails).toEqual([]);
    expect(payload.subject).toBe("Debit alert");
    expect(payload.text).toContain("Rs 1,250 spent");
  });

  it("parses Resend webhook-like nested payload", () => {
    const payload = extractIncomingEmailPayload({
      type: "email.received",
      data: {
        from: "alerts@resend.dev",
        to: "cc_26532e21c2eb4352b4ef828bc95a05e2@mail.cashcove.in",
        subject: "UPI debit",
        text: "₹60 paid to VC Cafe via UPI",
      },
    });

    expect(payload.fromEmail).toBe("alerts@resend.dev");
    expect(payload.recipientEmails).toEqual([
      "cc_26532e21c2eb4352b4ef828bc95a05e2@mail.cashcove.in",
    ]);
    expect(payload.subject).toBe("UPI debit");
    expect(payload.text).toContain("₹60 paid");
  });
});

describe("buildEmailSmartParseInput", () => {
  it("combines subject and body with new line", () => {
    expect(
      buildEmailSmartParseInput({
        subject: "Subject",
        text: "Body text",
      }),
    ).toBe("Subject\nBody text");
  });

  it("handles missing subject", () => {
    expect(
      buildEmailSmartParseInput({
        subject: "",
        text: "Body only",
      }),
    ).toBe("Body only");
  });
});
