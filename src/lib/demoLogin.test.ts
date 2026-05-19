import { describe, expect, it } from "vitest";
import { normalizeDemoLoginError } from "./demoLogin";

describe("normalizeDemoLoginError", () => {
  it("falls back to the generic message", () => {
    expect(normalizeDemoLoginError(null)).toBe(
      "Demo login is not available right now."
    );
  });

  it("uses explicit error messages", () => {
    expect(normalizeDemoLoginError(new Error("Demo login failed."))).toBe(
      "Demo login failed."
    );
  });
});
