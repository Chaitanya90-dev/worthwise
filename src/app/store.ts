import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../features/api/baseApi';
import financePreferencesReducer from '../features/settings/financePreferencesSlice';

export const store = configureStore({
  reducer: {
    financePreferences: financePreferencesReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

