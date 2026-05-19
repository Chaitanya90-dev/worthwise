alter table user_preferences
  add column if not exists locale text,
  add column if not exists base_currency text,
  add column if not exists display_currency text,
  add column if not exists exchange_rates jsonb;

update user_preferences
set
  locale = coalesce(locale, 'en-IN'),
  base_currency = coalesce(base_currency, 'INR'),
  display_currency = coalesce(display_currency, base_currency, 'INR'),
  exchange_rates = coalesce(exchange_rates, '{}'::jsonb);

alter table user_preferences
  alter column locale set default 'en-IN',
  alter column locale set not null,
  alter column base_currency set default 'INR',
  alter column base_currency set not null,
  alter column display_currency set default 'INR',
  alter column display_currency set not null,
  alter column exchange_rates set default '{}'::jsonb,
  alter column exchange_rates set not null;
