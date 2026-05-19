export const FUND_TYPE_LABELS: Record<string, string> = {
  emergency: "Emergency fund",
  car: "Car down payment",
  land: "Land down payment",
};

export type ContributionKind = "deposit" | "withdrawal";

export const CONTRIBUTION_TYPES: Array<{
  value: ContributionKind;
  label: string;
}> = [
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
];
