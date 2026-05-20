import { describe, expect, it } from 'vitest';
import { formatInr, formatPercent } from './format';

describe('format helpers', () => {
  it('formats INR values with Indian grouping', () => {
    expect(formatInr(1250000)).toBe('₹12,50,000');
  });

  it('formats percentage values consistently', () => {
    expect(formatPercent(8.5)).toBe('8.50%');
  });
});

