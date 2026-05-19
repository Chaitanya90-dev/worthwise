create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  parent_id uuid references categories(id) on delete set null,
  type text not null check (type in ('expense', 'income')),
  created_at timestamptz default now(),
  unique (user_id, name, parent_id)
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type text not null check (type in ('bank', 'card', 'wallet', 'cash', 'other')),
  current_balance numeric(14, 2) not null default 0,
  currency text not null default 'INR',
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null check (type in ('expense', 'income')),
  date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  category_id uuid references categories(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  counterparty_name text,
  counterparty_kind text check (counterparty_kind in ('merchant', 'person', 'bank', 'biller', 'platform', 'other')),
  merchant text,
  notes_enc text,
  is_transfer boolean default false,
  transfer_group_id uuid,
  is_reimbursement boolean default false,
  is_shared boolean default false,
  reimbursement_category_id uuid references categories(id) on delete set null,
  reimbursement_of_transaction_id uuid references transactions(id) on delete set null,
  is_recurring boolean default false,
  created_at timestamptz default now()
);

alter table transactions
  add column if not exists currency text not null default 'INR';

alter table transactions
  add column if not exists counterparty_name text;

alter table transactions
  add column if not exists counterparty_kind text;

alter table transactions
  add column if not exists merchant text;

create table if not exists transaction_tags (
  user_id uuid not null default auth.uid(),
  transaction_id uuid references transactions(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (transaction_id, tag_id)
);

create table if not exists telegram_ingest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  chat_id bigint,
  message_text text,
  parse_status text not null check (
    parse_status in ('unlinked_chat', 'parse_failed', 'insert_failed', 'success', 'error')
  ),
  error_text text,
  parsed_payload jsonb,
  transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_telegram_ingest_events_user_created_at
  on telegram_ingest_events (user_id, created_at desc);

create index if not exists idx_telegram_ingest_events_status_created_at
  on telegram_ingest_events (parse_status, created_at desc);

create table if not exists telegram_update_receipts (
  update_id bigint primary key,
  chat_id bigint not null,
  message_id bigint not null,
  created_at timestamptz default now(),
  unique (chat_id, message_id)
);

create table if not exists shared_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  created_at timestamptz default now(),
  unique (transaction_id)
);

create table if not exists shared_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  shared_expense_id uuid not null references shared_expenses(id) on delete cascade,
  name text not null,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  created_at timestamptz default now(),
  unique (shared_expense_id, name)
);

create table if not exists shared_reimbursements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  shared_expense_id uuid not null references shared_expenses(id) on delete cascade,
  participant_id uuid references shared_participants(id) on delete set null,
  transaction_id uuid not null references transactions(id) on delete cascade,
  created_at timestamptz default now(),
  unique (transaction_id)
);

create or replace function public.handle_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_delta numeric;
  new_delta numeric;
begin
  if tg_op = 'INSERT' then
    if new.account_id is not null and coalesce(new.is_transfer, false) = false then
      new_delta := case new.type when 'income' then new.amount else -new.amount end;
      update accounts
        set current_balance = coalesce(current_balance, 0) + new_delta
      where id = new.account_id and user_id = new.user_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.account_id is not null and coalesce(old.is_transfer, false) = false then
      old_delta := case old.type when 'income' then old.amount else -old.amount end;
      update accounts
        set current_balance = coalesce(current_balance, 0) - old_delta
      where id = old.account_id and user_id = old.user_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.account_id is not null and coalesce(old.is_transfer, false) = false then
      old_delta := case old.type when 'income' then old.amount else -old.amount end;
      update accounts
        set current_balance = coalesce(current_balance, 0) - old_delta
      where id = old.account_id and user_id = old.user_id;
    end if;
    if new.account_id is not null and coalesce(new.is_transfer, false) = false then
      new_delta := case new.type when 'income' then new.amount else -new.amount end;
      update accounts
        set current_balance = coalesce(current_balance, 0) + new_delta
      where id = new.account_id and user_id = new.user_id;
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists transaction_balance_trigger on transactions;
create trigger transaction_balance_trigger
after insert or update or delete on transactions
for each row execute function public.handle_transaction_balance();

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  estimated_base_amount numeric(12, 2) not null check (estimated_base_amount >= 0),
  interval_months integer not null default 1 check (interval_months >= 1),
  billing_anchor date not null,
  next_due date not null,
  last_paid date,
  last_billed_base_amount numeric(12, 2) check (last_billed_base_amount >= 0),
  last_fx_rate numeric(14, 6) check (last_fx_rate > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  lender_name text,
  loan_type text,
  repayment_mode text not null default 'scheduled' check (repayment_mode in ('scheduled', 'flexible')),
  principal_original numeric(14, 2) not null check (principal_original > 0),
  principal_outstanding numeric(14, 2) not null check (principal_outstanding >= 0),
  rate_type text not null check (rate_type in ('fixed', 'floating')),
  rate_current numeric(7, 4) not null check (rate_current >= 0),
  tenure_months integer not null check (tenure_months > 0),
  emi_amount numeric(14, 2) not null check (emi_amount > 0),
  repayment_day smallint not null check (repayment_day between 1 and 31),
  start_date date not null,
  first_due_date date not null,
  status text not null default 'active' check (status in ('active', 'closed', 'paused')),
  notes text,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists loan_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  loan_id uuid not null references loans(id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  due_date date not null,
  opening_principal numeric(14, 2) not null check (opening_principal >= 0),
  interest_due numeric(14, 2) not null default 0 check (interest_due >= 0),
  principal_due numeric(14, 2) not null default 0 check (principal_due >= 0),
  emi_due numeric(14, 2) not null check (emi_due >= 0),
  fees_due numeric(14, 2) not null default 0 check (fees_due >= 0),
  principal_paid numeric(14, 2) not null default 0 check (principal_paid >= 0),
  interest_paid numeric(14, 2) not null default 0 check (interest_paid >= 0),
  fees_paid numeric(14, 2) not null default 0 check (fees_paid >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  closing_principal_expected numeric(14, 2) not null check (closing_principal_expected >= 0),
  status text not null default 'due' check (status in ('due', 'paid', 'partial', 'overdue', 'skipped')),
  paid_date date,
  created_at timestamptz default now(),
  unique (loan_id, installment_no)
);

create table if not exists loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  loan_id uuid not null references loans(id) on delete cascade,
  schedule_id uuid references loan_schedule(id) on delete set null,
  payment_date date not null,
  amount_paid numeric(14, 2) not null check (amount_paid > 0),
  allocation_principal numeric(14, 2) not null default 0 check (allocation_principal >= 0),
  allocation_interest numeric(14, 2) not null default 0 check (allocation_interest >= 0),
  allocation_fees numeric(14, 2) not null default 0 check (allocation_fees >= 0),
  schedule_allocation_principal numeric(14, 2) not null default 0 check (schedule_allocation_principal >= 0),
  schedule_allocation_interest numeric(14, 2) not null default 0 check (schedule_allocation_interest >= 0),
  schedule_allocation_fees numeric(14, 2) not null default 0 check (schedule_allocation_fees >= 0),
  method text not null default 'emi' check (method in ('emi', 'prepayment', 'charge', 'waiver')),
  linked_transaction_id uuid references transactions(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

create table if not exists loan_rate_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  loan_id uuid not null references loans(id) on delete cascade,
  effective_date date not null,
  previous_rate numeric(7, 4) not null check (previous_rate >= 0),
  new_rate numeric(7, 4) not null check (new_rate >= 0),
  note text,
  created_at timestamptz default now()
);

create table if not exists reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  account_id uuid not null references accounts(id) on delete cascade,
  statement_date date not null,
  statement_balance numeric(14, 2) not null,
  adjusted boolean not null default false,
  note text,
  created_at timestamptz default now()
);

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  match_text text not null,
  match_type text not null check (match_type in ('contains', 'starts_with', 'equals', 'ends_with', 'regex')),
  transaction_type text not null default 'any' check (transaction_type in ('any', 'expense', 'income')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  tag_names text[] not null default '{}',
  is_active boolean not null default true,
  priority integer not null default 100,
  new_merchant_name text,
  created_at timestamptz default now()
);

-- update existing rules table if it exists
alter table rules
  drop constraint if exists rules_match_type_check;

alter table rules
  add constraint rules_match_type_check check (match_type in ('contains', 'starts_with', 'equals', 'ends_with', 'regex'));

alter table rules
  add column if not exists new_merchant_name text;

alter table rules
  add column if not exists account_id uuid references accounts(id) on delete set null;

alter table rules
  add column if not exists payment_method_id uuid references payment_methods(id) on delete set null;

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month text not null,
  category_id uuid references categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  rollover_enabled boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, month, category_id)
);

create table if not exists funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type text,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  monthly_contribution numeric(12, 2),
  target_date date,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, name)
);

alter table funds
  add column if not exists is_archived boolean not null default false;

create table if not exists fund_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  fund_id uuid references funds(id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount <> 0),
  note text,
  created_at timestamptz default now()
);

create table if not exists user_preferences (
  user_id uuid primary key default auth.uid(),
  weekly_summary_enabled boolean not null default false,
  weekly_summary_day smallint not null default 1 check (weekly_summary_day between 0 and 6),
  weekly_summary_time text not null default '08:00',
  weekly_summary_timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  base_currency text not null default 'INR',
  display_currency text not null default 'INR',
  exchange_rates jsonb not null default '{}'::jsonb,
  weekly_summary_last_sent_at timestamptz,
  is_readonly boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists quick_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  transaction_type text not null check (transaction_type in ('expense', 'income')),
  amount numeric(12, 2),
  merchant text,
  notes text,
  category_id uuid references categories(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name, transaction_type)
);

create or replace function prevent_readonly_writes()
returns trigger as $$
begin
  if exists (
    select 1
    from user_preferences
    where user_id = auth.uid()
      and is_readonly
  ) then
    raise exception 'Read-only account';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_readonly_writes_categories on categories;
create trigger prevent_readonly_writes_categories
  before insert or update or delete on categories
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_payment_methods on payment_methods;
create trigger prevent_readonly_writes_payment_methods
  before insert or update or delete on payment_methods
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_accounts on accounts;
create trigger prevent_readonly_writes_accounts
  before insert or update or delete on accounts
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_tags on tags;
create trigger prevent_readonly_writes_tags
  before insert or update or delete on tags
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_transactions on transactions;
create trigger prevent_readonly_writes_transactions
  before insert or update or delete on transactions
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_transaction_tags on transaction_tags;
create trigger prevent_readonly_writes_transaction_tags
  before insert or update or delete on transaction_tags
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_shared_expenses on shared_expenses;
create trigger prevent_readonly_writes_shared_expenses
  before insert or update or delete on shared_expenses
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_shared_participants on shared_participants;
create trigger prevent_readonly_writes_shared_participants
  before insert or update or delete on shared_participants
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_shared_reimbursements on shared_reimbursements;
create trigger prevent_readonly_writes_shared_reimbursements
  before insert or update or delete on shared_reimbursements
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_subscriptions on subscriptions;
create trigger prevent_readonly_writes_subscriptions
  before insert or update or delete on subscriptions
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_loans on loans;
create trigger prevent_readonly_writes_loans
  before insert or update or delete on loans
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_loan_schedule on loan_schedule;
create trigger prevent_readonly_writes_loan_schedule
  before insert or update or delete on loan_schedule
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_loan_payments on loan_payments;
create trigger prevent_readonly_writes_loan_payments
  before insert or update or delete on loan_payments
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_loan_rate_revisions on loan_rate_revisions;
create trigger prevent_readonly_writes_loan_rate_revisions
  before insert or update or delete on loan_rate_revisions
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_reconciliations on reconciliations;
create trigger prevent_readonly_writes_reconciliations
  before insert or update or delete on reconciliations
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_rules on rules;
create trigger prevent_readonly_writes_rules
  before insert or update or delete on rules
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_budgets on budgets;
create trigger prevent_readonly_writes_budgets
  before insert or update or delete on budgets
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_funds on funds;
create trigger prevent_readonly_writes_funds
  before insert or update or delete on funds
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_fund_contributions on fund_contributions;
create trigger prevent_readonly_writes_fund_contributions
  before insert or update or delete on fund_contributions
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_user_preferences on user_preferences;
create trigger prevent_readonly_writes_user_preferences
  before insert or update or delete on user_preferences
  for each row execute function prevent_readonly_writes();

drop trigger if exists prevent_readonly_writes_quick_templates on quick_templates;
create trigger prevent_readonly_writes_quick_templates
  before insert or update or delete on quick_templates
  for each row execute function prevent_readonly_writes();

alter table fund_contributions
  drop constraint if exists fund_contributions_amount_check;

alter table fund_contributions
  drop constraint if exists fund_contributions_amount_nonzero;

alter table fund_contributions
  add constraint fund_contributions_amount_nonzero check (amount <> 0);

alter table categories enable row level security;
alter table payment_methods enable row level security;
alter table accounts enable row level security;
alter table tags enable row level security;
alter table transactions enable row level security;
alter table transaction_tags enable row level security;
alter table telegram_ingest_events enable row level security;
alter table telegram_update_receipts enable row level security;
alter table shared_expenses enable row level security;
alter table shared_participants enable row level security;
alter table shared_reimbursements enable row level security;
alter table subscriptions enable row level security;
alter table loans enable row level security;
alter table loan_schedule enable row level security;
alter table loan_payments enable row level security;
alter table loan_rate_revisions enable row level security;
alter table reconciliations enable row level security;
alter table rules enable row level security;
alter table budgets enable row level security;
alter table funds enable row level security;
alter table fund_contributions enable row level security;
alter table user_preferences enable row level security;
alter table quick_templates enable row level security;

create policy "Categories are user-owned" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Payment methods are user-owned" on payment_methods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Accounts are user-owned" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Tags are user-owned" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Transactions are user-owned" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Transaction tags are user-owned" on transaction_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Telegram ingest events are user-owned" on telegram_ingest_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Shared expenses are user-owned" on shared_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Shared participants are user-owned" on shared_participants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Shared reimbursements are user-owned" on shared_reimbursements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Subscriptions are user-owned" on subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Loans are user-owned" on loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Loan schedule is user-owned" on loan_schedule
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Loan payments are user-owned" on loan_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Loan rate revisions are user-owned" on loan_rate_revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Reconciliations are user-owned" on reconciliations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Rules are user-owned" on rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Budgets are user-owned" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Funds are user-owned" on funds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Fund contributions are user-owned" on fund_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "User preferences are user-owned" on user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Quick templates are user-owned" on quick_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
