import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ApiError } from "./types";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: [
    "Transactions",
    "Budgets",
    "Categories",
    "PaymentMethods",
    "Accounts",
    "Tags",
    "Funds",
    "FundContributions",
    "Subscriptions",
    "Loans",
    "LoanSchedule",
    "LoanPayments",
    "LoanRateRevisions",
    "Reconciliations",
    "Rules",
    "SharedExpenses",
    "Preferences",
    "QuickTemplates",
  ],
  endpoints: () => ({}),
});
