import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type OfflineQueueState = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

const getInitialOnlineStatus = () => {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
};

const initialState: OfflineQueueState = {
  isOnline: getInitialOnlineStatus(),
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
};

const offlineQueueSlice = createSlice({
  name: "offlineQueue",
  initialState,
  reducers: {
    setOnlineStatus(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    setPendingCount(state, action: PayloadAction<number>) {
      state.pendingCount = Math.max(0, action.payload);
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    setSyncResult(
      state,
      action: PayloadAction<{ syncedAt: string; lastError: string | null }>,
    ) {
      state.lastSyncAt = action.payload.syncedAt;
      state.lastError = action.payload.lastError;
    },
    resetOfflineQueueState(state) {
      state.pendingCount = 0;
      state.isSyncing = false;
      state.lastSyncAt = null;
      state.lastError = null;
    },
  },
});

export const {
  setOnlineStatus,
  setPendingCount,
  setSyncing,
  setSyncResult,
  resetOfflineQueueState,
} = offlineQueueSlice.actions;

export default offlineQueueSlice.reducer;
