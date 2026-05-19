alter table subscriptions
  rename column estimated_inr_amount to estimated_base_amount;

alter table subscriptions
  rename column last_billed_inr_amount to last_billed_base_amount;

alter table subscriptions
  rename constraint subscriptions_estimated_inr_amount_check
  to subscriptions_estimated_base_amount_check;

alter table subscriptions
  rename constraint subscriptions_last_billed_inr_amount_check
  to subscriptions_last_billed_base_amount_check;
