export type EmiInput = {
  principal: number;
  annualRatePercent: number;
  tenureMonths: number;
};

export type EmiBreakdownInput = {
  openingPrincipal: number;
  annualRatePercent: number;
  emiAmount: number;
};

export type EmiBreakdown = {
  interestComponent: number;
  principalComponent: number;
  closingPrincipal: number;
};

export function calculateEmi({
  principal,
  annualRatePercent,
  tenureMonths,
}: EmiInput) {
  if (principal <= 0 || tenureMonths <= 0) {
    return 0;
  }

  const monthlyRate = annualRatePercent / 12 / 100;

  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }

  const growthFactor = Math.pow(1 + monthlyRate, tenureMonths);
  return (principal * monthlyRate * growthFactor) / (growthFactor - 1);
}

export function splitEmiPayment({
  openingPrincipal,
  annualRatePercent,
  emiAmount,
}: EmiBreakdownInput): EmiBreakdown {
  if (openingPrincipal <= 0 || emiAmount <= 0) {
    return {
      interestComponent: 0,
      principalComponent: 0,
      closingPrincipal: Math.max(openingPrincipal, 0),
    };
  }

  const monthlyRate = annualRatePercent / 12 / 100;
  const interestComponent = Math.max(openingPrincipal * monthlyRate, 0);
  const principalComponent = Math.min(
    Math.max(emiAmount - interestComponent, 0),
    openingPrincipal,
  );

  return {
    interestComponent,
    principalComponent,
    closingPrincipal: Math.max(openingPrincipal - principalComponent, 0),
  };
}

