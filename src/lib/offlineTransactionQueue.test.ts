import { beforeEach, describe, expect, it, vi } from "vitest";

const idbStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
}));

import {
  __resetOfflineTransactionQueueForTests,
  enqueueOfflineTransaction,
  getOfflineTransactionQueueCount,
  syncOfflineTransactionQueue,
  type QueuedTransactionPayload,
} from "./offlineTransactionQueue";

const buildPayload = (
  amount: number,
  merchant = "VC Cafe",
): QueuedTransactionPayload => ({
  type: "expense",
  date: "2026-03-14",
  amount,
  category_id: "cat-food",
  reimbursement_category_id: null,
  reimbursement_of_transaction_id: null,
  payment_method_id: "pm-upi",
  account_id: "acct-bob",
  merchant,
  notes: "offline",
  tags: ["food"],
  is_transfer: false,
  transfer_group_id: null,
  is_reimbursement: false,
  is_shared: false,
  is_recurring: false,
  sharedSplit: null,
  sharedReimbursement: null,
});

describe("offlineTransactionQueue", () => {
  beforeEach(async () => {
    idbStore.clear();
    await __resetOfflineTransactionQueueForTests();
  });

  it("enqueues transactions and counts per user scope", async () => {
    await enqueueOfflineTransaction({
      payload: buildPayload(60),
      userId: "user-1",
    });
    await enqueueOfflineTransaction({
      payload: buildPayload(70),
      userId: "user-2",
    });
    await enqueueOfflineTransaction({
      payload: buildPayload(80),
      userId: null,
    });

    expect(await getOfflineTransactionQueueCount()).toBe(3);
    expect(await getOfflineTransactionQueueCount({ userId: "user-1" })).toBe(2);
    expect(await getOfflineTransactionQueueCount({ userId: "user-2" })).toBe(2);
  });

  it("syncs queued entries and clears them on success", async () => {
    await enqueueOfflineTransaction({
      payload: buildPayload(30, "A"),
      userId: "user-1",
    });
    await enqueueOfflineTransaction({
      payload: buildPayload(40, "B"),
      userId: "user-1",
    });

    const syncedAmounts: number[] = [];
    const result = await syncOfflineTransactionQueue({
      userId: "user-1",
      process: async (payload) => {
        syncedAmounts.push(payload.amount);
      },
    });

    expect(result.attempted).toBe(2);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.pendingCountForUser).toBe(0);
    expect(syncedAmounts).toEqual([30, 40]);
    expect(await getOfflineTransactionQueueCount({ userId: "user-1" })).toBe(0);
  });

  it("continues after non-network failure and keeps failed item queued", async () => {
    await enqueueOfflineTransaction({
      payload: buildPayload(10, "keep"),
      userId: "user-1",
    });
    await enqueueOfflineTransaction({
      payload: buildPayload(20, "pass"),
      userId: "user-1",
    });

    const processed: string[] = [];
    const result = await syncOfflineTransactionQueue({
      userId: "user-1",
      process: async (payload) => {
        processed.push(payload.merchant ?? "");
        if (payload.merchant === "keep") {
          throw new Error("validation failed");
        }
      },
    });

    expect(processed).toEqual(["keep", "pass"]);
    expect(result.attempted).toBe(2);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.stoppedByNetwork).toBe(false);
    expect(result.pendingCountForUser).toBe(1);
  });

  it("stops sync when network failure happens", async () => {
    await enqueueOfflineTransaction({
      payload: buildPayload(10, "first"),
      userId: "user-1",
    });
    await enqueueOfflineTransaction({
      payload: buildPayload(20, "second"),
      userId: "user-1",
    });

    const processed: string[] = [];
    const result = await syncOfflineTransactionQueue({
      userId: "user-1",
      process: async (payload) => {
        processed.push(payload.merchant ?? "");
        throw new Error("Failed to fetch");
      },
    });

    expect(processed).toEqual(["first"]);
    expect(result.attempted).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.stoppedByNetwork).toBe(true);
    expect(result.pendingCountForUser).toBe(2);
  });
});
