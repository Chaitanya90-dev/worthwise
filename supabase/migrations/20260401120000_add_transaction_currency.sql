alter table public.transactions
  add column if not exists currency text;

update public.transactions as t
set currency = coalesce(
  (
    select a.currency
    from public.accounts as a
    where a.id = t.account_id
  ),
  currency,
  'INR'
)
where currency is null;

alter table public.transactions
  alter column currency set default 'INR',
  alter column currency set not null;
