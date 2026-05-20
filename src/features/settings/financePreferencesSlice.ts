import { createSlice } from '@reduxjs/toolkit';

type FinancePreferencesState = {
  currency: 'INR';
  locale: 'en-IN';
  countryCode: 'IN';
};

const initialState: FinancePreferencesState = {
  currency: 'INR',
  locale: 'en-IN',
  countryCode: 'IN',
};

const financePreferencesSlice = createSlice({
  name: 'financePreferences',
  initialState,
  reducers: {},
});

export default financePreferencesSlice.reducer;

