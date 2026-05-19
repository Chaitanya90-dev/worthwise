import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

type MockSupabaseOptions = {
  users?: Array<{ id: string; email?: string | null }>;
  categories?: Array<{ id: string; name: string }>;
  paymentMethods?: Array<{ id: string; name: string }>;
  accounts?: Array<{ id: string; name: string }>;
  rules?: Array<Record<string, unknown>>;
};

const ok = <T,>(data: T) => Promise.resolve({ data, error: null });

const makeLookupSelect = (
  data: unknown,
  eqCount = 1,
): { eq: (column: string, value: unknown) => unknown } => {
  let remaining = eqCount;
  const chain = {
    eq: () => {
      remaining -= 1;
      if (remaining <= 0) {
        return ok(data);
      }
      return chain;
    },
  };
  return chain;
};

const makeSupabaseMock = (options: MockSupabaseOptions = {}) => {
  const insertedTransactions: Array<Record<string, unknown>> = [];
  const linkedTags: Array<Record<string, unknown>> = [];
  const upsertedTags: Array<Record<string, unknown>> = [];

  const users = options.users ?? [{ id: "user-1", email: "demo@cashcove.in" }];
  const categories = options.categories ?? [{ id: "cat-food", name: "Food" }];
  const paymentMethods = options.paymentMethods ?? [{ id: "pm-upi", name: "UPI" }];
  const accounts = options.accounts ?? [
    { id: "acct-bob", name: "Bank of Baroda Savings Account" },
  ];
  const rules = options.rules ?? [];

  const supabase = {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users },
          error: null,
        })),
        getUserById: vi.fn(async (userId: string) => ({
          data: {
            user: users.find((user) => user.id === userId) ?? null,
          },
          error: null,
        })),
      },
    },
    from: vi.fn((table: string) => {
      if (table === "categories") {
        return {
          select: vi.fn(() => makeLookupSelect(categories)),
        };
      }

      if (table === "payment_methods") {
        return {
          select: vi.fn(() => makeLookupSelect(paymentMethods)),
        };
      }

      if (table === "accounts") {
        return {
          select: vi.fn(() => makeLookupSelect(accounts)),
        };
      }

      if (table === "rules") {
        return {
          select: vi.fn(() => makeLookupSelect(rules, 2)),
        };
      }

      if (table === "transactions") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            insertedTransactions.push(row);
            const idx = insertedTransactions.length;
            return {
              select: vi.fn(() => ({
                single: vi.fn(() =>
                  ok({
                    id: `txn-${idx}`,
                    amount: row.amount ?? 0,
                    date: row.date ?? "2026-03-14",
                  }),
                ),
              })),
            };
          }),
        };
      }

      if (table === "tags") {
        return {
          upsert: vi.fn((rows: Array<Record<string, unknown>>) => {
            upsertedTags.push(...rows);
            return {
              select: vi.fn(() =>
                ok(
                  rows.map((_, idx) => ({
                    id: `tag-${idx + 1}`,
                  })),
                ),
              ),
            };
          }),
        };
      }

      if (table === "transaction_tags") {
        return {
          insert: vi.fn((rows: Array<Record<string, unknown>>) => {
            linkedTags.push(...rows);
            return ok(null);
          }),
        };
      }

      throw new Error(`Unexpected table in mock: ${table}`);
    }),
  };

  return {
    supabase,
    insertedTransactions,
    upsertedTags,
    linkedTags,
  };
};

const loadHandler = async () => {
  vi.resetModules();
  process.env.SUPABASE_URL = "https://demo.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.EMAIL_INGEST_SECRET = "test-secret";
  const module = await import("../functions/email-forward-parser");
  return module.handler;
};

describe("email-forward-parser handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.EMAIL_INGEST_SECRET;
  });

  it("parses Mailgun-style urlencoded payload in dry-run mode", async () => {
    const mock = makeSupabaseMock();
    createClientMock.mockReturnValue(mock.supabase);
    const handler = await loadHandler();

    const body = new URLSearchParams({
      sender: "Demo User <demo@cashcove.in>",
      subject: "UPI debit alert",
      "stripped-text":
        "30 rs at VC Cafe for varan vati via BOB UPI category food tags lunch,pune",
    }).toString();

    const response = await handler(
      {
        httpMethod: "POST",
        body,
        isBase64Encoded: false,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-cashcove-ingest-secret": "test-secret",
        },
        queryStringParameters: {
          dry_run: "1",
        },
      } as never,
      {} as never,
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.dry_run).toBe(true);
    expect(payload.user_id).toBe("user-1");
    expect(payload.resolved_via).toBe("sender_email");
    expect(payload.preview[0]).toMatchObject({
      amount: 30,
      merchant: "VC Cafe",
      payment: "UPI",
      account: "Bank of Baroda Savings Account",
    });
    expect(mock.insertedTransactions).toHaveLength(0);
  });

  it("parses multipart/form-data payload for provider inbound routes", async () => {
    const mock = makeSupabaseMock();
    createClientMock.mockReturnValue(mock.supabase);
    const handler = await loadHandler();

    const boundary = "----cashcoveInbound";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="from"',
      "",
      "Demo User <demo@cashcove.in>",
      `--${boundary}`,
      'Content-Disposition: form-data; name="subject"',
      "",
      "Debit alert",
      `--${boundary}`,
      'Content-Disposition: form-data; name="stripped-text"',
      "",
      "60 rs at VC Cafe for poli bhaji via BOB UPI category food",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await handler(
      {
        httpMethod: "POST",
        body,
        isBase64Encoded: false,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "x-cashcove-ingest-secret": "test-secret",
        },
        queryStringParameters: {
          dry_run: "true",
        },
      } as never,
      {} as never,
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.dry_run).toBe(true);
    expect(payload.resolved_via).toBe("sender_email");
    expect(payload.preview.length).toBeGreaterThan(0);
    expect(payload.preview[0]).toMatchObject({
      amount: 60,
      merchant: "VC Cafe",
    });
  });

  it("imports transactions and tags from JSON payload when dry-run is disabled", async () => {
    const mock = makeSupabaseMock();
    createClientMock.mockReturnValue(mock.supabase);
    const handler = await loadHandler();

    const response = await handler(
      {
        httpMethod: "POST",
        body: JSON.stringify({
          from: "demo@cashcove.in",
          subject: "Fwd: UPI debit",
          text: "30 rs at VC Cafe for varan vati via BOB UPI category food tags lunch,pune",
        }),
        isBase64Encoded: false,
        headers: {
          "content-type": "application/json",
          "x-cashcove-ingest-secret": "test-secret",
        },
        queryStringParameters: {},
      } as never,
      {} as never,
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.imported_count).toBe(1);
    expect(payload.resolved_via).toBe("sender_email");
    expect(mock.insertedTransactions).toHaveLength(1);
    expect(mock.insertedTransactions[0]).toMatchObject({
      amount: 30,
      merchant: "VC Cafe",
    });
    expect(mock.upsertedTags).toEqual([
      { user_id: "user-1", name: "lunch" },
      { user_id: "user-1", name: "pune" },
    ]);
    expect(mock.linkedTags).toHaveLength(2);
  });

  it("resolves the user from recipient alias before sender email", async () => {
    const aliasUserId = "26532e21-c2eb-4352-b4ef-828bc95a05e2";
    const mock = makeSupabaseMock({
      users: [
        { id: aliasUserId, email: "owner@cashcove.in" },
        { id: "user-1", email: "another@cashcove.in" },
      ],
    });
    createClientMock.mockReturnValue(mock.supabase);
    const handler = await loadHandler();

    const response = await handler(
      {
        httpMethod: "POST",
        body: JSON.stringify({
          from: "bank-alerts@issuer.com",
          to: `CashCove <cc_26532e21c2eb4352b4ef828bc95a05e2@mail.cashcove.in>`,
          subject: "Fwd: UPI debit",
          text: "30 rs at VC Cafe for varan vati via BOB UPI category food",
        }),
        isBase64Encoded: false,
        headers: {
          "content-type": "application/json",
          "x-cashcove-ingest-secret": "test-secret",
        },
        queryStringParameters: {
          dry_run: "1",
        },
      } as never,
      {} as never,
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.user_id).toBe(aliasUserId);
    expect(payload.resolved_via).toBe("recipient_alias");
    expect(payload.recipient_emails).toEqual([
      "cc_26532e21c2eb4352b4ef828bc95a05e2@mail.cashcove.in",
    ]);
  });
});
