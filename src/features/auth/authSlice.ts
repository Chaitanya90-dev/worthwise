import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "idle" | "loading" | "authed" | "unauth";

export type AuthState = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
};

const initialState: AuthState = {
  session: null,
  user: null,
  status: "loading",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.user = action.payload?.user ?? null;
      state.status = action.payload ? "authed" : "unauth";
    },
    setStatus(state, action: PayloadAction<AuthStatus>) {
      state.status = action.payload;
    },
    clearAuth(state) {
      state.session = null;
      state.user = null;
      state.status = "unauth";
    },
  },
});

export const { setSession, setStatus, clearAuth } = authSlice.actions;

export default authSlice.reducer;
