import { describe, expect, it } from "vitest";
import {
  buildEmailIngestAddress,
  buildEmailIngestAlias,
  extractUserIdFromEmailIngestAlias,
} from "./emailIngest";

const USER_ID = "26532e21-c2eb-4352-b4ef-828bc95a05e2";

describe("emailIngest", () => {
  it("builds a deterministic alias from user id", () => {
    expect(buildEmailIngestAlias(USER_ID)).toBe(
      "cc_26532e21c2eb4352b4ef828bc95a05e2",
    );
  });

  it("builds a full routing address when domain is configured", () => {
    expect(buildEmailIngestAddress(USER_ID, "@mail.cashcove.in")).toBe(
      "cc_26532e21c2eb4352b4ef828bc95a05e2@mail.cashcove.in",
    );
  });

  it("extracts user id from alias token or full address", () => {
    expect(
      extractUserIdFromEmailIngestAlias(
        "cc_26532e21c2eb4352b4ef828bc95a05e2",
      ),
    ).toBe(USER_ID);
    expect(
      extractUserIdFromEmailIngestAlias(
        "CashCove <cc_26532e21c2eb4352b4ef828bc95a05e2@mail.cashcove.in>",
      ),
    ).toBe(USER_ID);
  });
});
