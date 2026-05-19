export type CategoryType = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  type: CategoryType;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type Account = {
  id: string;
  name: string;
  type: "bank" | "card" | "wallet" | "cash" | "other";
  current_balance: number;
  currency: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type QuickTemplate = {
  id: string;
  name: string;
  transaction_type: "expense" | "income";
  amount: number | null;
  merchant: string | null;
  notes: string | null;
  category_id: string | null;
  payment_method_id: string | null;
  account_id: string | null;
};

export type CounterpartyKind =
  | "merchant"
  | "person"
  | "bank"
  | "biller"
  | "platform"
  | "other";

export type Transaction = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: number;
  currency?: string | null;
  category_id: string | null;
  reimbursement_category_id?: string | null;
  reimbursement_of_transaction_id?: string | null;
  payment_method_id: string | null;
  account_id?: string | null;
  counterparty_name?: string | null;
  counterparty_kind?: CounterpartyKind | null;
  merchant?: string | null;
  notes?: string | null;
  notes_enc?: string | null;
  is_transfer?: boolean;
  transfer_group_id?: string | null;
  is_reimbursement?: boolean;
  is_shared?: boolean;
  is_recurring: boolean;
  tags?: Tag[];
};

export type SharedParticipant = {
  id: string;
  name: string;
  share_amount: number;
};

export type SharedReimbursement = {
  id: string;
  transaction_id: string;
  participant_id: string | null;
  transaction: Transaction;
};

export type SharedExpense = {
  id: string;
  transaction_id: string;
  transaction: Transaction;
  participants: SharedParticipant[];
  reimbursements: SharedReimbursement[];
};

export type Budget = {
  id: string;
  month: string;
  category_id: string | null;
  amount: number;
  rollover_enabled: boolean;
};

export type Fund = {
  id: string;
  name: string;
  type: string | null;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  target_date: string | null;
  notes: string | null;
  is_archived: boolean;
};

export type FundContribution = {
  id: string;
  fund_id: string;
  date: string;
  amount: number;
  note: string | null;
  fund_name?: string | null;
};

export type LoanRateType = "fixed" | "floating";
export type LoanRepaymentMode = "scheduled" | "flexible";
export type LoanStatus = "active" | "closed" | "paused";
export type LoanScheduleStatus =
  | "due"
  | "paid"
  | "partial"
  | "overdue"
  | "skipped";
export type LoanPaymentMethod = "emi" | "prepayment" | "charge" | "waiver";

export type Loan = {
  id: string;
  name: string;
  lender_name: string | null;
  loan_type: string | null;
  repayment_mode: LoanRepaymentMode;
  principal_original: number;
  principal_outstanding: number;
  rate_type: LoanRateType;
  rate_current: number;
  tenure_months: number;
  emi_amount: number;
  repayment_day: number;
  start_date: string;
  first_due_date: string;
  status: LoanStatus;
  notes: string | null;
};

export type LoanScheduleItem = {
  id: string;
  loan_id: string;
  loan_name?: string | null;
  installment_no: number;
  due_date: string;
  opening_principal: number;
  interest_due: number;
  principal_due: number;
  emi_due: number;
  fees_due: number;
  principal_paid: number;
  interest_paid: number;
  fees_paid: number;
  amount_paid: number;
  closing_principal_expected: number;
  status: LoanScheduleStatus;
  paid_date: string | null;
};

export type LoanPayment = {
  id: string;
  loan_id: string;
  loan_name?: string | null;
  schedule_id: string | null;
  payment_date: string;
  amount_paid: number;
  allocation_principal: number;
  allocation_interest: number;
  allocation_fees: number;
  schedule_allocation_principal?: number;
  schedule_allocation_interest?: number;
  schedule_allocation_fees?: number;
  method: LoanPaymentMethod;
  linked_transaction_id: string | null;
  note: string | null;
};

export type LoanRateRevision = {
  id: string;
  loan_id: string;
  loan_name?: string | null;
  effective_date: string;
  previous_rate: number;
  new_rate: number;
  note: string | null;
};

export type SubscriptionStatus = "active" | "paused" | "cancelled";

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  estimated_base_amount: number;
  interval_months: number;
  billing_anchor: string;
  next_due: string;
  last_paid: string | null;
  last_billed_base_amount: number | null;
  last_fx_rate: number | null;
  status: SubscriptionStatus;
  category_id: string | null;
  account_id: string | null;
  payment_method_id: string | null;
  notes: string | null;
};

export type Reconciliation = {
  id: string;
  account_id: string;
  statement_balance: number;
  statement_date: string;
  note: string | null;
  adjusted: boolean;
};

export type RuleMatchType =
  | "contains"
  | "starts_with"
  | "equals"
  | "ends_with"
  | "regex";
export type RuleTransactionType = "any" | "expense" | "income";

export type TransactionRule = {
  id: string;
  name: string;
  match_text: string;
  match_type: RuleMatchType;
  transaction_type: RuleTransactionType;
  category_id: string | null;
  account_id?: string | null;
  payment_method_id?: string | null;
  tag_names: string[];
  is_active: boolean;
  priority: number;
  new_merchant_name?: string | null;
};

export type UserPreferences = {
  user_id: string;
  weekly_summary_enabled: boolean;
  weekly_summary_day: number;
  weekly_summary_time: string;
  weekly_summary_timezone: string;
  locale: string;
  base_currency: string;
  display_currency: string;
  exchange_rates: Record<string, number>;
  weekly_summary_last_sent_at?: string | null;
  is_readonly?: boolean | null;
  telegram_chat_id?: number | null;
};

export type TelegramIngestStatus =
  | "unlinked_chat"
  | "parse_failed"
  | "insert_failed"
  | "success"
  | "error";

export type TelegramIngestEvent = {
  id: string;
  chat_id: number | null;
  message_text: string | null;
  parse_status: TelegramIngestStatus;
  error_text: string | null;
  parsed_payload: Record<string, unknown> | null;
  transaction_id: string | null;
  created_at: string;
};
