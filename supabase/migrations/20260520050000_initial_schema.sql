create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_currency text not null default 'INR',
  country_code text not null default 'IN',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_default_currency_check check (default_currency = 'INR'),
  constraint profiles_country_code_check check (country_code = 'IN')
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null,
  institution_name text,
  account_number_mask text,
  currency text not null default 'INR',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_currency_check check (currency = 'INR'),
  constraint accounts_type_check check (
    account_type in (
      'cash',
      'savings',
      'current',
      'credit_card',
      'loan',
      'investment',
      'other'
    )
  )
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_type text not null,
  color text,
  icon text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_type_check check (
    category_type in ('income', 'expense', 'transfer', 'investment', 'loan')
  )
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  occurred_on date not null,
  transaction_type text not null,
  amount numeric(14,2) not null,
  currency text not null default 'INR',
  merchant text,
  description text,
  payment_mode text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_check check (amount >= 0),
  constraint transactions_currency_check check (currency = 'INR'),
  constraint transactions_type_check check (
    transaction_type in ('income', 'expense', 'transfer', 'adjustment')
  )
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_account_id uuid references public.accounts(id) on delete set null,
  loan_kind text not null,
  lender_name text not null,
  loan_account_number_mask text,
  branch_name text,
  sanctioned_amount numeric(14,2),
  principal_amount numeric(14,2) not null,
  outstanding_amount numeric(14,2) not null,
  interest_rate_percent numeric(6,3) not null,
  interest_rate_type text not null default 'fixed',
  emi_amount numeric(14,2) not null,
  emi_day integer not null,
  start_date date not null,
  tenure_months integer not null,
  repayment_mode text,
  autopay_enabled boolean not null default false,
  status text not null default 'active',
  notes text,
  property_name text,
  property_address text,
  property_type text,
  possession_status text,
  co_borrower_name text,
  tax_tracking_enabled boolean not null default false,
  interest_certificate_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_kind_check check (
    loan_kind in (
      'personal',
      'vehicle',
      'education',
      'consumer_durable',
      'gold',
      'home',
      'loan_against_property',
      'other'
    )
  ),
  constraint loans_interest_rate_type_check check (
    interest_rate_type in ('fixed', 'floating', 'hybrid')
  ),
  constraint loans_emi_day_check check (emi_day between 1 and 31),
  constraint loans_status_check check (
    status in ('active', 'closed', 'paused', 'written_off')
  ),
  constraint loans_amounts_check check (
    principal_amount >= 0
    and outstanding_amount >= 0
    and emi_amount >= 0
  ),
  constraint loans_tenure_check check (tenure_months > 0)
);

create table public.loan_rate_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  effective_from date not null,
  old_rate_percent numeric(6,3),
  new_rate_percent numeric(6,3) not null,
  emi_amount numeric(14,2),
  tenure_months integer,
  notes text,
  created_at timestamptz not null default now()
);

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  paid_on date not null,
  due_on date,
  amount numeric(14,2) not null,
  principal_component numeric(14,2),
  interest_component numeric(14,2),
  penalty_amount numeric(14,2) not null default 0,
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loan_repayments_amount_check check (amount >= 0),
  constraint loan_repayments_components_check check (
    (principal_component is null or principal_component >= 0)
    and (interest_component is null or interest_component >= 0)
    and penalty_amount >= 0
  )
);

create table public.loan_prepayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  paid_on date not null,
  amount numeric(14,2) not null,
  strategy text not null,
  fee_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loan_prepayments_amount_check check (amount > 0 and fee_amount >= 0),
  constraint loan_prepayments_strategy_check check (
    strategy in ('reduce_tenure', 'reduce_emi', 'undecided')
  )
);

create table public.loan_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  document_type text not null,
  document_name text not null,
  storage_path text,
  issued_on date,
  financial_year text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_type text not null,
  insurer_name text not null,
  policy_name text,
  policy_number_mask text,
  sum_assured numeric(14,2),
  premium_amount numeric(14,2) not null,
  premium_frequency text not null,
  start_date date not null,
  next_due_date date,
  maturity_date date,
  premium_payment_end_date date,
  nominee_name text,
  agent_name text,
  agent_contact text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_policy_type_check check (policy_type in ('lic', 'term', 'other')),
  constraint insurance_frequency_check check (
    premium_frequency in ('monthly', 'quarterly', 'half_yearly', 'yearly', 'single')
  ),
  constraint insurance_status_check check (status in ('active', 'lapsed', 'paid_up', 'closed'))
);

create table public.insurance_premium_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid not null references public.insurance_policies(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  paid_on date not null,
  due_on date,
  amount numeric(14,2) not null,
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_premium_amount_check check (amount >= 0)
);

create table public.mutual_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_house text,
  scheme_name text not null,
  folio_number_mask text,
  plan_type text,
  option_type text,
  invested_amount numeric(14,2) not null default 0,
  units numeric(18,6) not null default 0,
  current_nav numeric(14,4),
  nav_date date,
  current_value numeric(14,2),
  sip_amount numeric(14,2),
  sip_day integer,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mutual_funds_sip_day_check check (sip_day is null or sip_day between 1 and 31),
  constraint mutual_funds_status_check check (status in ('active', 'paused', 'redeemed', 'archived'))
);

create table public.mutual_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_id uuid not null references public.mutual_funds(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  transaction_date date not null,
  transaction_type text not null,
  amount numeric(14,2) not null,
  units numeric(18,6),
  nav numeric(14,4),
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mutual_fund_transaction_type_check check (
    transaction_type in ('sip', 'lump_sum', 'redeem', 'switch_in', 'switch_out', 'dividend')
  ),
  constraint mutual_fund_transaction_amount_check check (amount >= 0)
);

create table public.recurring_obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  name text not null,
  amount numeric(14,2) not null,
  currency text not null default 'INR',
  frequency text not null,
  next_due_date date not null,
  autopay_enabled boolean not null default false,
  account_id uuid references public.accounts(id) on delete set null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_obligations_source_type_check check (
    source_type in ('manual', 'loan', 'insurance', 'mutual_fund', 'subscription', 'bill')
  ),
  constraint recurring_obligations_currency_check check (currency = 'INR'),
  constraint recurring_obligations_frequency_check check (
    frequency in ('one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly')
  ),
  constraint recurring_obligations_status_check check (
    status in ('active', 'paused', 'closed')
  )
);

create table public.app_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'INR',
  locale text not null default 'en-IN',
  country_code text not null default 'IN',
  financial_year_start_month integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_preferences_currency_check check (currency = 'INR'),
  constraint app_preferences_country_code_check check (country_code = 'IN'),
  constraint app_preferences_financial_year_start_check check (
    financial_year_start_month between 1 and 12
  )
);

create index accounts_user_id_idx on public.accounts(user_id);
create index categories_user_id_idx on public.categories(user_id);
create index transactions_user_id_occurred_on_idx on public.transactions(user_id, occurred_on desc);
create index loans_user_id_status_idx on public.loans(user_id, status);
create index loan_rate_changes_loan_id_effective_from_idx on public.loan_rate_changes(loan_id, effective_from desc);
create index loan_repayments_loan_id_paid_on_idx on public.loan_repayments(loan_id, paid_on desc);
create index loan_prepayments_loan_id_paid_on_idx on public.loan_prepayments(loan_id, paid_on desc);
create index insurance_policies_user_id_status_idx on public.insurance_policies(user_id, status);
create index mutual_funds_user_id_status_idx on public.mutual_funds(user_id, status);
create index recurring_obligations_user_id_next_due_date_idx on public.recurring_obligations(user_id, next_due_date);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

create trigger loans_set_updated_at before update on public.loans
for each row execute function public.set_updated_at();

create trigger loan_repayments_set_updated_at before update on public.loan_repayments
for each row execute function public.set_updated_at();

create trigger loan_prepayments_set_updated_at before update on public.loan_prepayments
for each row execute function public.set_updated_at();

create trigger insurance_policies_set_updated_at before update on public.insurance_policies
for each row execute function public.set_updated_at();

create trigger insurance_premium_payments_set_updated_at before update on public.insurance_premium_payments
for each row execute function public.set_updated_at();

create trigger mutual_funds_set_updated_at before update on public.mutual_funds
for each row execute function public.set_updated_at();

create trigger mutual_fund_transactions_set_updated_at before update on public.mutual_fund_transactions
for each row execute function public.set_updated_at();

create trigger recurring_obligations_set_updated_at before update on public.recurring_obligations
for each row execute function public.set_updated_at();

create trigger app_preferences_set_updated_at before update on public.app_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.loans enable row level security;
alter table public.loan_rate_changes enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.loan_prepayments enable row level security;
alter table public.loan_documents enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurance_premium_payments enable row level security;
alter table public.mutual_funds enable row level security;
alter table public.mutual_fund_transactions enable row level security;
alter table public.recurring_obligations enable row level security;
alter table public.app_preferences enable row level security;

create policy "Users can manage own profile"
on public.profiles for all
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can manage own accounts"
on public.accounts for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own categories"
on public.categories for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own transactions"
on public.transactions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own loans"
on public.loans for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own loan rate changes"
on public.loan_rate_changes for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own loan repayments"
on public.loan_repayments for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own loan prepayments"
on public.loan_prepayments for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own loan documents"
on public.loan_documents for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own insurance policies"
on public.insurance_policies for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own insurance premium payments"
on public.insurance_premium_payments for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own mutual funds"
on public.mutual_funds for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own mutual fund transactions"
on public.mutual_fund_transactions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own recurring obligations"
on public.recurring_obligations for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own app preferences"
on public.app_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

