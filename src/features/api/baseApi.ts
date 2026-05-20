import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'worthwiseApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Account', 'Loan', 'Obligation', 'Insurance', 'MutualFund'],
  endpoints: () => ({}),
});

