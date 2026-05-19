alter table public.transactions
  add column if not exists counterparty_name text;

alter table public.transactions
  add column if not exists counterparty_kind text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_counterparty_kind_check'
  ) then
    alter table public.transactions
      add constraint transactions_counterparty_kind_check
      check (
        counterparty_kind in (
          'merchant',
          'person',
          'bank',
          'biller',
          'platform',
          'other'
        )
      );
  end if;
end $$;

update public.transactions
set
  counterparty_name = coalesce(counterparty_name, merchant),
  counterparty_kind = coalesce(
    counterparty_kind,
    case
      when coalesce(counterparty_name, merchant) ~* '\m(amazon|flipkart|swiggy|zomato|uber|ola|netflix|spotify|youtube|google|apple|phonepe|gpay|google pay|paytm|razorpay|airbnb)\M' then 'platform'
      when coalesce(counterparty_name, merchant) ~* '\m(bank|neft|imps|rtgs|acct|account|a/c|ifsc|upi from|upi to|transfer)\M' then 'bank'
      when coalesce(counterparty_name, merchant) ~* '\m(rent|insurance|premium|loan|emi|subscription|recharge|electricity|water|gas|broadband|internet|bill|tax|term plan)\M' then 'biller'
      when coalesce(counterparty_name, merchant) is not null then 'merchant'
      else null
    end
  ),
  merchant = coalesce(merchant, counterparty_name)
where coalesce(counterparty_name, merchant) is not null;
