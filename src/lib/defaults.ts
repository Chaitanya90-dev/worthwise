import type { CategoryType } from "../types/finance";

export const defaultCategories: Array<{ name: string; type: CategoryType }> = [
  { name: "Bills", type: "expense" },
  { name: "EMI", type: "expense" },
  { name: "Food & Drinks", type: "expense" },
  { name: "Fuel", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Travel", type: "expense" },
  { name: "Other", type: "expense" },
];

export const defaultPaymentMethods = ["Cash", "Card", "UPI", "Bank Transfer"];
