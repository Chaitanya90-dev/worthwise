import { describe, expect, it } from 'vitest';
import { calculateEmi, splitEmiPayment } from './loans';

describe('loan helpers', () => {
  it('calculates EMI for a reducing balance loan', () => {
    const emi = calculateEmi({
      principal: 1_000_000,
      annualRatePercent: 8.5,
      tenureMonths: 240,
    });

    expect(Math.round(emi)).toBe(8678);
  });

  it('splits an EMI into interest and principal components', () => {
    const split = splitEmiPayment({
      openingPrincipal: 1_000_000,
      annualRatePercent: 12,
      emiAmount: 20_000,
    });

    expect(split.interestComponent).toBe(10_000);
    expect(split.principalComponent).toBe(10_000);
    expect(split.closingPrincipal).toBe(990_000);
  });
});

