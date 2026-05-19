alter table subscriptions
  add column if not exists estimated_inr_amount numeric(12, 2),
  add column if not exists last_billed_inr_amount numeric(12, 2),
  add column if not exists last_fx_rate numeric(14, 6);

update subscriptions
set
  estimated_inr_amount = coalesce(estimated_inr_amount, amount),
  last_billed_inr_amount = case
    when currency = 'INR' then coalesce(last_billed_inr_amount, amount)
    else last_billed_inr_amount
  end,
  last_fx_rate = case
    when currency = 'INR' then coalesce(last_fx_rate, 1)
    else last_fx_rate
  end;

alter table subscriptions
  alter column estimated_inr_amount set not null;

alter table subscriptions
  add constraint subscriptions_estimated_inr_amount_check
    check (estimated_inr_amount >= 0);

alter table subscriptions
  add constraint subscriptions_last_billed_inr_amount_check
    check (last_billed_inr_amount is null or last_billed_inr_amount >= 0);

alter table subscriptions
  add constraint subscriptions_last_fx_rate_check
    check (last_fx_rate is null or last_fx_rate > 0);
