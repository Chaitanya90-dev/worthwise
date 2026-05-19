import { get, set } from "idb-keyval";
import type { CounterpartyKind } from "../types/finance";

export type QueuedTransactionPayload = {
  type: "expense" | "income";
  date: string;
  amount: number;
  currency?: string | null;
  category_id: string | null;
  reimbursement_category_id?: string | null;
  reimbursement_of_transaction_id?: string | null;
  payment_method_id: string | null;
  account_id?: string | null;
  counterparty_name?: string | null;
  counterparty_kind?: CounterpartyKind | null;
  merchant?: string | null;
  notes?: string | null;
  tags?: string[];
  is_transfer?: boolean;
  transfer_group_id?: string | null;
  is_reimbursement?: boolean;
  is_shared?: boolean;
  is_recurring: boolean;
  sharedSplit?: {
    participants: Array<{
      id?: string;
      name: string;
      share_amount: number;
    }>;
  } | null;
  sharedReimbursement?: {
    shared_expense_id: string;
    participant_id: string | null;
  } | null;
};

export type OfflineQueuedTransaction = {
  id: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  lastError: string | null;
  payload: QueuedTransactionPayload;
};

export type OfflineQueueSyncResult = {
  attempted: number;
  synced: number;
  failed: number;
  stoppedByNetwork: boolean;
  pendingCount: number;
  pendingCountForUser: number;
  firstError: string | null;
  syncedAt: string;
};

const OFFLINE_QUEUE_KEY = "cashcove:offline:transactions:v1";

let memoryQueue: OfflineQueuedTransaction[] = [];
let queueLock: Promise<void> = Promise.resolve();
let activeSync: Promise<OfflineQueueSyncResult> | null = null;

const createQueueId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeQueuedTransaction = (
  value: unknown,
): OfflineQueuedTransaction | null => {
  if (!isObject(value) || !isObject(value.payload)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : null;
  if (!id) {
    return null;
  }

  const createdAt =
    typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const updatedAt =
    typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  const attemptCount =
    typeof value.attemptCount === "number" && Number.isFinite(value.attemptCount)
      ? value.attemptCount
      : 0;
  const lastError =
    typeof value.lastError === "string" && value.lastError.trim()
      ? value.lastError
      : null;
  const userId = typeof value.userId === "string" ? value.userId : null;

  return {
    id,
    userId,
    createdAt,
    updatedAt,
    attemptCount,
    lastError,
    payload: value.payload as QueuedTransactionPayload,
  };
};

const normalizeQueue = (value: unknown): OfflineQueuedTransaction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeQueuedTransaction(item))
    .filter((item): item is OfflineQueuedTransaction => Boolean(item));
};

const readQueueUnsafe = async () => {
  try {
    const stored = await get<unknown>(OFFLINE_QUEUE_KEY);
    const normalized = normalizeQueue(stored);
    memoryQueue = normalized;
    return normalized;
  } catch {
    return [...memoryQueue];
  }
};

const writeQueueUnsafe = async (queue: OfflineQueuedTransaction[]) => {
  memoryQueue = [...queue];
  try {
    await set(OFFLINE_QUEUE_KEY, queue);
  } catch {
    // Keep in-memory fallback when IndexedDB is unavailable.
  }
};

const isQueueItemForUser = (item: OfflineQueuedTransaction, userId?: string) => {
  if (!userId) {
    return true;
  }
  return item.userId === null || item.userId === userId;
};

const withQueueLock = async <T>(action: () => Promise<T>) => {
  const next = queueLock.then(action, action);
  queueLock = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

export const isLikelyNetworkError = (message: string) =>
  /(failed to fetch|fetch failed|network|offline|timeout|connection|abort)/i.test(
    message,
  );

export const enqueueOfflineTransaction = async ({
  payload,
  userId,
}: {
  payload: QueuedTransactionPayload;
  userId: string | null;
}) =>
  withQueueLock(async () => {
    const queue = await readQueueUnsafe();
    const now = new Date().toISOString();
    const item: OfflineQueuedTransaction = {
      id: createQueueId(),
      userId,
      createdAt: now,
      updatedAt: now,
      attemptCount: 0,
      lastError: null,
      payload,
    };

    const nextQueue = [...queue, item];
    await writeQueueUnsafe(nextQueue);
    return item;
  });

export const getOfflineTransactionQueueCount = async (input?: {
  userId?: string;
}) => {
  const queue = await readQueueUnsafe();
  return queue.filter((item) => isQueueItemForUser(item, input?.userId)).length;
};

export const syncOfflineTransactionQueue = async ({
  userId,
  process,
}: {
  userId: string;
  process: (
    payload: QueuedTransactionPayload,
    item: OfflineQueuedTransaction,
  ) => Promise<void>;
}) => {
  if (activeSync) {
    return activeSync;
  }

  activeSync = withQueueLock(async () => {
    const queue = await readQueueUnsafe();
    if (queue.length === 0) {
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        stoppedByNetwork: false,
        pendingCount: 0,
        pendingCountForUser: 0,
        firstError: null,
        syncedAt: new Date().toISOString(),
      } satisfies OfflineQueueSyncResult;
    }

    const now = new Date().toISOString();
    const nextQueue: OfflineQueuedTransaction[] = [];
    let attempted = 0;
    let synced = 0;
    let failed = 0;
    let stoppedByNetwork = false;
    let firstError: string | null = null;

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      if (!isQueueItemForUser(item, userId)) {
        nextQueue.push(item);
        continue;
      }

      attempted += 1;
      try {
        await process(item.payload, item);
        synced += 1;
      } catch (error) {
        const message = toErrorMessage(error);
        if (!firstError) {
          firstError = message;
        }

        const failedItem: OfflineQueuedTransaction = {
          ...item,
          updatedAt: now,
          attemptCount: item.attemptCount + 1,
          lastError: message,
        };

        nextQueue.push(failedItem);

        if (isLikelyNetworkError(message)) {
          stoppedByNetwork = true;
          for (let remainder = index + 1; remainder < queue.length; remainder += 1) {
            nextQueue.push(queue[remainder]);
          }
          break;
        }

        failed += 1;
      }
    }

    await writeQueueUnsafe(nextQueue);

    return {
      attempted,
      synced,
      failed,
      stoppedByNetwork,
      pendingCount: nextQueue.length,
      pendingCountForUser: nextQueue.filter((item) =>
        isQueueItemForUser(item, userId),
      ).length,
      firstError,
      syncedAt: now,
    } satisfies OfflineQueueSyncResult;
  }).finally(() => {
    activeSync = null;
  });

  return activeSync;
};

export const __resetOfflineTransactionQueueForTests = async () => {
  memoryQueue = [];
  activeSync = null;
  queueLock = Promise.resolve();
  await writeQueueUnsafe([]);
};
