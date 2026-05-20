export type CurrencyCode = 'INR';

export type AccountType =
  | 'cash'
  | 'savings'
  | 'current'
  | 'credit_card'
  | 'loan'
  | 'investment'
  | 'other';

export type PaymentMode =
  | 'upi'
  | 'bank_transfer'
  | 'card'
  | 'cash'
  | 'cheque'
  | 'autopay'
  | 'nach_ecs'
  | 'net_banking'
  | 'other';

export type Frequency =
  | 'one_time'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly';

export type LoanKind =
  | 'personal'
  | 'vehicle'
  | 'education'
  | 'consumer_durable'
  | 'gold'
  | 'home'
  | 'loan_against_property'
  | 'other';

export type InterestRateType = 'fixed' | 'floating' | 'hybrid';

