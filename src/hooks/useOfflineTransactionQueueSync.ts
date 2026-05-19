import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { apiSlice } from "../features/api/apiSlice";
import { submitTransactionOnline } from "../features/api/transactionsApi";
import {
  resetOfflineQueueState,
  setOnlineStatus,
  setPendingCount,
  setSyncResult,
  setSyncing,
} from "../features/offline/offlineQueueSlice";
import { getOfflineTransactionQueueCount, syncOfflineTransactionQueue } from "../lib/offlineTransactionQueue";

const readOnlineStatus = () => {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
};

export const useOfflineTransactionQueueSync = () => {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.status);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const pendingCount = useAppSelector((state) => state.offlineQueue.pendingCount);
  const isOnline = useAppSelector((state) => state.offlineQueue.isOnline);

  useEffect(() => {
    const handleOnlineState = () => {
      dispatch(setOnlineStatus(readOnlineStatus()));
    };

    handleOnlineState();
    globalThis.addEventListener("online", handleOnlineState);
    globalThis.addEventListener("offline", handleOnlineState);

    return () => {
      globalThis.removeEventListener("online", handleOnlineState);
      globalThis.removeEventListener("offline", handleOnlineState);
    };
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;

    const refreshCount = async () => {
      if (!userId || authStatus !== "authed") {
        if (!cancelled) {
          dispatch(resetOfflineQueueState());
        }
        return;
      }

      const pendingCount = await getOfflineTransactionQueueCount({ userId });
      if (!cancelled) {
        dispatch(setPendingCount(pendingCount));
      }
    };

    void refreshCount();

    return () => {
      cancelled = true;
    };
  }, [authStatus, dispatch, userId]);

  useEffect(() => {
    if (!userId || authStatus !== "authed") {
      return;
    }
    if (!isOnline || pendingCount <= 0) {
      return;
    }

    let cancelled = false;

    const runSync = async () => {
      dispatch(setSyncing(true));
      try {
        const result = await syncOfflineTransactionQueue({
          userId,
          process: async (payload) => {
            const outcome = await submitTransactionOnline(payload);
            if ("error" in outcome) {
              throw new Error(outcome.error.message);
            }
          },
        });

        if (cancelled) {
          return;
        }

        dispatch(setPendingCount(result.pendingCountForUser));
        dispatch(
          setSyncResult({
            syncedAt: result.syncedAt,
            lastError:
              result.failed > 0
                ? result.firstError ??
                  `${result.failed} queued transaction(s) failed to sync.`
                : result.stoppedByNetwork
                  ? "Sync paused because the connection dropped."
                  : null,
          }),
        );

        if (result.synced > 0) {
          dispatch(
            apiSlice.util.invalidateTags([
              "Transactions",
              "Accounts",
              "SharedExpenses",
            ]),
          );
        }
      } finally {
        if (!cancelled) {
          dispatch(setSyncing(false));
        }
      }
    };

    void runSync();

    const handleOnline = () => {
      dispatch(setOnlineStatus(true));
      void runSync();
    };

    globalThis.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      globalThis.removeEventListener("online", handleOnline);
      dispatch(setSyncing(false));
    };
  }, [authStatus, dispatch, isOnline, pendingCount, userId]);
};
